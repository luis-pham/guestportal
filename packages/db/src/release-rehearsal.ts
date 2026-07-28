import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const migrationsDir = resolve(__dirname, '../drizzle');
const evidenceDir = resolve(repoRoot, 'evidence/phase-10/10.3');
const artifactsDir = resolve(evidenceDir, 'artifacts');
const reportPath = resolve(evidenceDir, 'backup-restore-rehearsal.json');

type StepReport = {
  name: string;
  passed: boolean;
  details: Record<string, unknown>;
};

type IntegritySnapshot = {
  database: string;
  schema: string;
  migrationIds: string[];
  tableCounts: Record<string, number>;
  indexes: string[];
  rlsTables: Array<{ table: string; rowSecurity: boolean; forceRowSecurity: boolean }>;
  appRoleCanConnect: boolean;
};

type Target = {
  mode: 'database' | 'schema';
  name: string;
  url: string;
  schema: string;
};

const databaseUrl = process.env.DATABASE_OWNER_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_OWNER_URL or DATABASE_URL is required');
}

function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function databaseName(url: string) {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

function withDatabase(url: string, dbName: string) {
  const parsed = new URL(url);
  parsed.pathname = `/${encodeURIComponent(dbName)}`;
  return parsed.toString();
}

function tempName(label: string) {
  const suffix = `${Date.now()}_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  return `guestportal_${label}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function requireBinary(name: string) {
  const result = spawnSync('which', [name], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${name} is required for the Phase 10.3 rehearsal`);
  }
  return result.stdout.trim();
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with exit ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

async function createDatabase(adminUrl: string, dbName: string) {
  const sql = postgres(adminUrl, { max: 1 });
  await sql.unsafe(`CREATE DATABASE ${quoteIdent(dbName)}`);
  await sql.end();
}

async function dropDatabase(adminUrl: string, dbName: string) {
  const sql = postgres(adminUrl, { max: 1 });
  await sql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${dbName}
      AND pid <> pg_backend_pid()
  `;
  await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`);
  await sql.end();
}

async function createSchema(adminUrl: string, schema: string) {
  const sql = postgres(adminUrl, { max: 1 });
  await sql.unsafe(`CREATE SCHEMA ${quoteIdent(schema)}`);
  await sql.end();
}

async function dropSchema(adminUrl: string, schema: string) {
  const sql = postgres(adminUrl, { max: 1 });
  await sql.unsafe(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
  await sql.end();
}

async function openTarget(target: Target) {
  const sql = postgres(target.url, { max: 1 });
  if (target.mode === 'schema') {
    await sql.unsafe(`SET search_path TO ${quoteIdent(target.schema)}, public`);
  }
  return sql;
}

async function applyMigrations(target: Target, files: string[]) {
  const sql = await openTarget(target);
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  for (const file of files) {
    const applied = await sql<{ id: string }[]>`
      SELECT id FROM schema_migrations WHERE id = ${file}
    `;
    if (applied.length > 0) continue;

    const body = readFileSync(join(migrationsDir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
    });
  }

  await sql.end();
}

async function seedIntegrityFixture(target: Target) {
  const sql = await openTarget(target);
  await sql`select set_config('app.organization_id', '', true)`;

  const [org] = await sql<{ id: string }[]>`
    INSERT INTO organizations (name, slug, default_locale)
    VALUES ('Phase 10 Rehearsal Org', 'phase-10-rehearsal', 'vi')
    RETURNING id
  `;
  const [property] = await sql<{ id: string }[]>`
    INSERT INTO properties (
      organization_id,
      type,
      name,
      slug,
      timezone,
      currency,
      default_locale,
      supported_locales
    )
    VALUES (
      ${org!.id},
      'hotel',
      'Phase 10 Rehearsal Hotel',
      'phase-10-rehearsal-hotel',
      'Asia/Ho_Chi_Minh',
      'USD',
      'vi',
      ARRAY['vi','en']::text[]
    )
    RETURNING id
  `;
  const [location] = await sql<{ id: string }[]>`
    INSERT INTO locations (organization_id, property_id, name, type)
    VALUES (${org!.id}, ${property!.id}, 'Lobby', 'public_area')
    RETURNING id
  `;
  const [user] = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, display_name, locale)
    VALUES ('phase10.rehearsal@example.test', 'phase10-rehearsal-hash', 'Phase 10 Rehearsal', 'vi')
    RETURNING id
  `;
  await sql`
    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (${org!.id}, ${user!.id}, 'organization_owner')
  `;
  await sql`
    INSERT INTO property_assignments (organization_id, property_id, user_id)
    VALUES (${org!.id}, ${property!.id}, ${user!.id})
  `;
  await sql`
    INSERT INTO qr_codes (
      organization_id,
      property_id,
      location_id,
      token_hash,
      destination_type,
      created_by
    )
    VALUES (${org!.id}, ${property!.id}, ${location!.id}, 'phase10-rehearsal-token-hash', 'portal_home', ${user!.id})
  `;

  await sql.end();
}

async function integritySnapshot(target: Target): Promise<IntegritySnapshot> {
  const sql = await openTarget(target);
  const tables = [
    'schema_migrations',
    'organizations',
    'properties',
    'locations',
    'users',
    'organization_memberships',
    'property_assignments',
    'qr_codes',
  ];
  const tableCounts: Record<string, number> = {};

  for (const table of tables) {
    const qualifiedName = `${target.schema}.${table}`;
    const exists = await sql<{ exists: boolean }[]>`
      SELECT to_regclass(${qualifiedName}) IS NOT NULL AS exists
    `;
    if (!exists[0]?.exists) {
      tableCounts[table] = -1;
      continue;
    }
    const rows = await sql.unsafe<{ count: string }[]>(`SELECT count(*) FROM ${quoteIdent(table)}`);
    tableCounts[table] = Number(rows[0]?.count ?? 0);
  }

  const migrations = await sql<{ id: string }[]>`
    SELECT id FROM schema_migrations ORDER BY id
  `;
  const indexes = await sql<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = ${target.schema}
    ORDER BY indexname
  `;
  const rlsTables = await sql<
    Array<{ table: string; rowSecurity: boolean; forceRowSecurity: boolean }>
  >`
    SELECT
      relname AS table,
      relrowsecurity AS "rowSecurity",
      relforcerowsecurity AS "forceRowSecurity"
    FROM pg_class
    WHERE relnamespace = ${target.schema}::regnamespace
      AND relkind = 'r'
      AND relname IN ('organizations', 'properties', 'organization_memberships', 'property_assignments', 'audit_logs')
    ORDER BY relname
  `;
  const appRole = await sql<{ can_connect: boolean }[]>`
    SELECT has_database_privilege('guestportal_app', current_database(), 'CONNECT') AS can_connect
  `;
  const currentDb = await sql<{ current_database: string }[]>`SELECT current_database()`;

  await sql.end();
  return {
    database: currentDb[0]!.current_database,
    schema: target.schema,
    migrationIds: migrations.map((row) => row.id),
    tableCounts,
    indexes: indexes.map((row) => row.indexname),
    rlsTables,
    appRoleCanConnect: Boolean(appRole[0]?.can_connect),
  };
}

function dumpTarget(target: Target, outputPath: string) {
  const args = ['--format=custom', '--no-owner', '--no-privileges', '--file', outputPath];
  if (target.mode === 'schema') {
    args.push('--schema', target.schema);
  }
  args.push(target.url);
  return run('pg_dump', args);
}

function restoreTarget(target: Target, inputPath: string) {
  return run('pg_restore', ['--no-owner', '--no-privileges', '--dbname', target.url, inputPath]);
}

function equalJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCreateDatabasePermissionError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '42501'
  );
}

function targetLabel(target: Target) {
  return target.mode === 'database' ? target.name : `${databaseName(target.url)}.${target.schema}`;
}

async function runRehearsal(input: {
  mode: 'database' | 'schema';
  files: string[];
  latestMigration: string;
  previousMigrations: string[];
  pgDumpPath: string;
  pgRestorePath: string;
  sourceDatabase: string;
  targets: {
    fresh: Target;
    upgrade: Target;
    restored: Target;
    rollback: Target;
  };
  resetForRestore: (target: Target) => Promise<void>;
}) {
  const preUpgradeDump = resolve(artifactsDir, `${input.targets.upgrade.name}-pre-upgrade.dump`);
  const postUpgradeDump = resolve(artifactsDir, `${input.targets.upgrade.name}-post-upgrade.dump`);
  const steps: StepReport[] = [];

  await applyMigrations(input.targets.fresh, input.files);
  const fresh = await integritySnapshot(input.targets.fresh);
  steps.push({
    name: 'fresh migration',
    passed:
      fresh.migrationIds.length === input.files.length &&
      fresh.migrationIds.at(-1) === input.latestMigration &&
      fresh.appRoleCanConnect &&
      fresh.rlsTables.every((table) => table.rowSecurity && table.forceRowSecurity),
    details: { target: targetLabel(input.targets.fresh), snapshot: fresh },
  });

  await applyMigrations(input.targets.upgrade, input.previousMigrations);
  await seedIntegrityFixture(input.targets.upgrade);
  const preUpgrade = await integritySnapshot(input.targets.upgrade);
  dumpTarget(input.targets.upgrade, preUpgradeDump);
  await applyMigrations(input.targets.upgrade, input.files);
  const postUpgrade = await integritySnapshot(input.targets.upgrade);
  steps.push({
    name: 'upgrade migration',
    passed:
      preUpgrade.migrationIds.length === input.previousMigrations.length &&
      !preUpgrade.migrationIds.includes(input.latestMigration) &&
      postUpgrade.migrationIds.length === input.files.length &&
      postUpgrade.migrationIds.includes(input.latestMigration) &&
      postUpgrade.indexes.includes('outbox_events_org_property_created_idx') &&
      postUpgrade.appRoleCanConnect,
    details: { target: targetLabel(input.targets.upgrade), before: preUpgrade, after: postUpgrade },
  });

  dumpTarget(input.targets.upgrade, postUpgradeDump);
  await input.resetForRestore(input.targets.restored);
  restoreTarget(input.targets.restored, postUpgradeDump);
  const restored = await integritySnapshot(input.targets.restored);
  steps.push({
    name: 'backup restore',
    passed:
      equalJson(restored.migrationIds, postUpgrade.migrationIds) &&
      equalJson(restored.tableCounts, postUpgrade.tableCounts) &&
      restored.indexes.includes('outbox_events_org_property_created_idx') &&
      restored.appRoleCanConnect,
    details: {
      sourceTarget: targetLabel(input.targets.upgrade),
      restoredTarget: targetLabel(input.targets.restored),
      dumpFile: postUpgradeDump,
      restored,
    },
  });

  await input.resetForRestore(input.targets.rollback);
  restoreTarget(input.targets.rollback, preUpgradeDump);
  const rollback = await integritySnapshot(input.targets.rollback);
  steps.push({
    name: 'rollback rehearsal',
    passed:
      equalJson(rollback.migrationIds, preUpgrade.migrationIds) &&
      equalJson(rollback.tableCounts, preUpgrade.tableCounts) &&
      !rollback.migrationIds.includes(input.latestMigration),
    details: {
      upgradedTarget: targetLabel(input.targets.upgrade),
      rollbackTarget: targetLabel(input.targets.rollback),
      dumpFile: preUpgradeDump,
      rollback,
    },
  });

  rmSync(preUpgradeDump, { force: true });
  rmSync(postUpgradeDump, { force: true });

  return {
    generatedAt: new Date().toISOString(),
    environment: process.env.CI ? 'ci' : 'local',
    mode: input.mode,
    sourceDatabase: input.sourceDatabase,
    migrationCount: input.files.length,
    latestMigration: input.latestMigration,
    tools: { pgDumpPath: input.pgDumpPath, pgRestorePath: input.pgRestorePath },
    temporaryTargets: Object.fromEntries(
      Object.entries(input.targets).map(([key, target]) => [key, targetLabel(target)]),
    ),
    steps,
    passed: steps.every((step) => step.passed),
  };
}

async function runDatabaseMode(input: {
  adminUrl: string;
  files: string[];
  latestMigration: string;
  previousMigrations: string[];
  pgDumpPath: string;
  pgRestorePath: string;
  sourceDatabase: string;
}) {
  const names = {
    fresh: tempName('fresh'),
    upgrade: tempName('upgrade'),
    restored: tempName('restored'),
    rollback: tempName('rollback'),
  };
  const targets = {
    fresh: {
      mode: 'database' as const,
      name: names.fresh,
      url: withDatabase(input.adminUrl, names.fresh),
      schema: 'public',
    },
    upgrade: {
      mode: 'database' as const,
      name: names.upgrade,
      url: withDatabase(input.adminUrl, names.upgrade),
      schema: 'public',
    },
    restored: {
      mode: 'database' as const,
      name: names.restored,
      url: withDatabase(input.adminUrl, names.restored),
      schema: 'public',
    },
    rollback: {
      mode: 'database' as const,
      name: names.rollback,
      url: withDatabase(input.adminUrl, names.rollback),
      schema: 'public',
    },
  };

  try {
    for (const name of Object.values(names)) {
      await createDatabase(input.adminUrl, name);
    }
    return await runRehearsal({
      ...input,
      mode: 'database',
      targets,
      resetForRestore: async () => {},
    });
  } finally {
    for (const name of Object.values(names).reverse()) {
      await dropDatabase(input.adminUrl, name).catch((error) => {
        console.error(`Failed to drop temporary database ${name}:`, error);
      });
    }
  }
}

async function runSchemaMode(input: {
  adminUrl: string;
  files: string[];
  latestMigration: string;
  previousMigrations: string[];
  pgDumpPath: string;
  pgRestorePath: string;
  sourceDatabase: string;
}) {
  const schemas = {
    fresh: tempName('fresh_schema'),
    upgrade: tempName('upgrade_schema'),
  };
  const upgradeTarget = {
    mode: 'schema' as const,
    name: schemas.upgrade,
    url: input.adminUrl,
    schema: schemas.upgrade,
  };
  const targets = {
    fresh: {
      mode: 'schema' as const,
      name: schemas.fresh,
      url: input.adminUrl,
      schema: schemas.fresh,
    },
    upgrade: upgradeTarget,
    restored: upgradeTarget,
    rollback: upgradeTarget,
  };

  try {
    await createSchema(input.adminUrl, schemas.fresh);
    await createSchema(input.adminUrl, schemas.upgrade);
    return await runRehearsal({
      ...input,
      mode: 'schema',
      targets,
      resetForRestore: async (target) => {
        await dropSchema(input.adminUrl, target.schema);
      },
    });
  } finally {
    for (const schema of Object.values(schemas).reverse()) {
      await dropSchema(input.adminUrl, schema).catch((error) => {
        console.error(`Failed to drop temporary schema ${schema}:`, error);
      });
    }
  }
}

function writeReport(report: { passed: boolean }) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

async function main() {
  const files = migrationFiles();
  if (files.length < 2)
    throw new Error('At least two migrations are required for upgrade rehearsal');
  const latestMigration = files[files.length - 1]!;
  const previousMigrations = files.slice(0, -1);
  const pgDumpPath = requireBinary('pg_dump');
  const pgRestorePath = requireBinary('pg_restore');
  const adminUrl = databaseUrl!;
  const sourceDatabase = databaseName(adminUrl);

  mkdirSync(artifactsDir, { recursive: true });

  try {
    const report = await runDatabaseMode({
      adminUrl,
      files,
      latestMigration,
      previousMigrations,
      pgDumpPath,
      pgRestorePath,
      sourceDatabase,
    });
    writeReport(report);
  } catch (error) {
    if (!isCreateDatabasePermissionError(error)) throw error;
    console.warn('CREATE DATABASE is unavailable; falling back to isolated schemas.');
    const report = await runSchemaMode({
      adminUrl,
      files,
      latestMigration,
      previousMigrations,
      pgDumpPath,
      pgRestorePath,
      sourceDatabase,
    });
    writeReport(report);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

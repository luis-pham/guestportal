#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';

const phase = process.argv[2];
if (!phase) {
  console.error('Usage: pnpm phase:run <phase>');
  process.exit(1);
}

const phaseId = phase.padStart(2, '0');
const root = process.cwd();
const evidenceDir = join(root, 'evidence', `phase-${phaseId}`);
const commandsDir = join(evidenceDir, 'commands');
const logsDir = join(evidenceDir, 'logs');
const buildDir = join(evidenceDir, 'build');

for (const dir of [
  evidenceDir,
  commandsDir,
  logsDir,
  buildDir,
  join(evidenceDir, 'junit'),
  join(evidenceDir, 'screenshots'),
]) {
  mkdirSync(dir, { recursive: true });
}

const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const startedAt = new Date().toISOString();

/** @type {Array<{name: string, command: string, optionalBlocked?: boolean}>} */
const suitesByPhase = {
  '00': [
    { name: 'lint', command: 'pnpm lint' },
    { name: 'typecheck', command: 'pnpm typecheck' },
    { name: 'unit', command: 'pnpm test' },
    { name: 'build', command: 'pnpm build' },
    { name: 'format', command: 'pnpm format:check' },
    { name: 'docker-health', command: 'pnpm docker:health', optionalBlocked: true },
  ],
  '01': [
    { name: 'lint', command: 'pnpm lint' },
    { name: 'typecheck', command: 'pnpm typecheck' },
    { name: 'unit', command: 'pnpm test' },
    { name: 'migrate', command: 'pnpm db:migrate' },
    { name: 'seed', command: 'pnpm db:seed' },
    { name: 'integration', command: 'pnpm test:integration' },
    { name: 'build', command: 'pnpm build' },
    { name: 'format', command: 'pnpm format:check' },
    { name: 'docker-health', command: 'pnpm docker:health', optionalBlocked: true },
    { name: 'e2e', command: 'node scripts/run-phase01-e2e.mjs' },
  ],
  '02': [
    { name: 'lint', command: 'pnpm lint' },
    { name: 'typecheck', command: 'pnpm typecheck' },
    { name: 'unit', command: 'pnpm test' },
    { name: 'integration', command: 'pnpm test:integration' },
    { name: 'build', command: 'pnpm build' },
    { name: 'e2e-admin', command: 'node scripts/run-admin-e2e.mjs' },
    { name: 'e2e-staff', command: 'node scripts/run-staff-e2e.mjs' },
    { name: 'e2e-i18n', command: 'node scripts/run-i18n-e2e.mjs' },
    { name: 'visual', command: 'node scripts/run-phase02-visual.mjs' },
  ],
};

const suites = suitesByPhase[phaseId] ?? [
  { name: 'lint', command: 'pnpm lint' },
  { name: 'typecheck', command: 'pnpm typecheck' },
  { name: 'unit', command: 'pnpm test' },
  { name: 'build', command: 'pnpm build' },
];

const commandResults = [];
let hardFailure = false;

for (const suite of suites) {
  const start = new Date().toISOString();
  const logPath = join(logsDir, `${suite.name}.log`);
  const out = createWriteStream(logPath);
  console.log(`\n▶ ${suite.name}: ${suite.command}`);

  const result = spawnSync(suite.command, {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  out.write(result.stdout ?? '');
  out.write(result.stderr ?? '');
  out.end();

  const exitCode = result.status ?? 1;
  const blocked = Boolean(suite.optionalBlocked && exitCode === 2);
  commandResults.push({
    name: suite.name,
    command: suite.command,
    startedAt: start,
    finishedAt: new Date().toISOString(),
    exitCode,
    logPath: `logs/${suite.name}.log`,
    blocked,
  });

  if (exitCode !== 0 && !blocked) {
    console.error(`✖ ${suite.name} failed with exit code ${exitCode}`);
    hardFailure = true;
    break;
  }
  if (blocked) {
    console.warn(`△ ${suite.name} blocked (missing external prerequisite)`);
  } else {
    console.log(`✔ ${suite.name}`);
  }
}

const finishedAt = new Date().toISOString();
const metadata = {
  phase: phaseId,
  commitSha,
  startedAt,
  finishedAt,
  environment: process.env.CI ? 'ci' : 'local',
  requiredSuites: suites.map((suite) => suite.name),
};

writeFileSync(join(evidenceDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
writeFileSync(
  join(evidenceDir, 'command-results.json'),
  `${JSON.stringify(commandResults, null, 2)}\n`,
);

console.log(`\nEvidence written to evidence/phase-${phaseId}`);
if (hardFailure) {
  process.exit(1);
}

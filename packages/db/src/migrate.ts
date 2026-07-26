import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const migrationsDir = join(__dirname, '..', 'drizzle');

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await sql<{ id: string }[]>`
      SELECT id FROM schema_migrations WHERE id = ${file}
    `;
    if (applied.length > 0) {
      continue;
    }

    const body = readFileSync(join(migrationsDir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
    });
    console.log(`Applied migration ${file}`);
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

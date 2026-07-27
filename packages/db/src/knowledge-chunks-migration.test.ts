import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describe('knowledge_chunks migration', () => {
  it('defines versioning, FTS, trigram and vector columns', () => {
    const sql = readFileSync(join(__dirname, '../drizzle/0010_knowledge_chunks.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS knowledge_chunks');
    expect(sql).toContain('embedding vector(768)');
    expect(sql).toContain('content_tsv');
    expect(sql).toContain('gin_trgm_ops');
    expect(sql).toContain('active boolean');
    expect(sql).toContain('knowledge_chunks_tenant_policy');
  });
});

describeDb('knowledge_chunks live schema', () => {
  const sql = postgres(databaseUrl!, { max: 1 });

  afterAll(async () => {
    await sql.end();
  });

  it('exposes versioning columns and required extensions', async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'knowledge_chunks'
      ORDER BY column_name
    `;
    const names = cols.map((c) => c.column_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'active',
        'content',
        'content_hash',
        'content_tsv',
        'embedding',
        'heading_path',
        'source_id',
        'source_language',
        'version',
      ]),
    );

    const ext = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_trgm')
    `;
    expect(ext.map((e) => e.extname).sort()).toEqual(['pg_trgm', 'vector']);
  });
});

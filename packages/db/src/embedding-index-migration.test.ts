import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describe('embedding hnsw migration', () => {
  it('creates partial HNSW index on active embeddings', () => {
    const sql = readFileSync(
      join(__dirname, '../drizzle/0011_knowledge_chunk_embedding_hnsw.sql'),
      'utf8',
    );
    expect(sql).toContain('USING hnsw');
    expect(sql).toContain('vector_cosine_ops');
    expect(sql).toContain('active = true');
  });
});

describeDb('embedding index live', () => {
  const sql = postgres(databaseUrl!, { max: 1 });

  afterAll(async () => {
    await sql.end();
  });

  it('has knowledge_chunks_embedding_hnsw_idx', async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'knowledge_chunks'
        AND indexname = 'knowledge_chunks_embedding_hnsw_idx'
    `;
    expect(rows).toHaveLength(1);
  });
});

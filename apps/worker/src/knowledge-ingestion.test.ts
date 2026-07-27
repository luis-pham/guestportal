import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  resetIngestionIdempotencyStore,
  runKnowledgeIngestionJob,
} from './knowledge-ingestion.js';

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/rag/fixtures',
);

describe('knowledge ingestion job', () => {
  beforeEach(() => {
    resetIngestionIdempotencyStore();
  });

  it('parses fixtures and is idempotent for the same key', async () => {
    const bytes = readFileSync(join(fixtures, 'sample.txt'));
    const first = await runKnowledgeIngestionJob({
      idempotencyKey: 'job-1',
      sourceId: '11111111-1111-4111-8111-111111111111',
      mimeType: 'text/plain',
      filename: 'sample.txt',
      bytes,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.idempotentReplay).toBe(false);
    expect(first.document.text).toContain('aurora-guest');

    const second = await runKnowledgeIngestionJob({
      idempotencyKey: 'job-1',
      sourceId: '11111111-1111-4111-8111-111111111111',
      mimeType: 'text/plain',
      filename: 'sample.txt',
      bytes,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotentReplay).toBe(true);
    expect(second.document.provenance.checksumSha256).toBe(
      first.document.provenance.checksumSha256,
    );
  });

  it('returns recoverable failure for malformed empty docs', async () => {
    const result = await runKnowledgeIngestionJob({
      idempotencyKey: 'job-empty',
      sourceId: '11111111-1111-4111-8111-111111111111',
      mimeType: 'text/plain',
      bytes: Buffer.from('\n\n'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('EMPTY_DOCUMENT');
  });
});

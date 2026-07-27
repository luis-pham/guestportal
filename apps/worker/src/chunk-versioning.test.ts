import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ChunkVersionStore } from './chunk-versioning.js';

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/rag/fixtures',
);

describe('chunk version invalidation', () => {
  it('invalidates previous active chunks when source is re-ingested', async () => {
    const store = new ChunkVersionStore();
    const bytes = readFileSync(join(fixtures, 'sample.txt'));
    const sourceId = '22222222-2222-4222-8222-222222222222';

    const first = await store.replaceFromParsedDocument({
      organizationId: '11111111-1111-4111-8111-111111111111',
      propertyId: '33333333-3333-4333-8333-333333333333',
      sourceId,
      previousVersion: 0,
      parse: { bytes, mimeType: 'text/plain', filename: 'sample.txt' },
    });
    expect(first.version).toBe(1);
    expect(first.chunks.length).toBeGreaterThan(0);
    expect(store.listActive(sourceId)).toHaveLength(first.chunks.length);

    const updated = Buffer.from(
      `${bytes.toString('utf8')}\nGym: 24 hours\n`,
      'utf8',
    );
    const second = await store.replaceFromParsedDocument({
      organizationId: '11111111-1111-4111-8111-111111111111',
      propertyId: '33333333-3333-4333-8333-333333333333',
      sourceId,
      previousVersion: first.version,
      parse: { bytes: updated, mimeType: 'text/plain', filename: 'sample.txt' },
    });

    expect(second.version).toBe(2);
    expect(second.invalidatedPrevious).toBe(true);
    const active = store.listActive(sourceId);
    expect(active.every((c) => c.version === 2)).toBe(true);
    expect(active.some((c) => c.content.includes('Gym'))).toBe(true);
    const stale = store.listAll(sourceId).filter((c) => c.version === 1);
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.every((c) => c.active === false && c.invalidatedAt)).toBe(true);
  });
});

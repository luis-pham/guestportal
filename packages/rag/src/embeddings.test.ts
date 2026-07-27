import { describe, expect, it, vi } from 'vitest';
import {
  EMBEDDING_DIMENSIONS,
  assertEmbeddingDimensions,
  assertSingleTenantBatch,
  createEmbeddingClient,
  toPgVectorLiteral,
  EmbeddingError,
} from './embeddings.js';

describe('embedding client', () => {
  it('enforces exact 768 dimensions', () => {
    expect(() => assertEmbeddingDimensions(new Array(768).fill(0.1))).not.toThrow();
    expect(() => assertEmbeddingDimensions([1, 2, 3])).toThrow(EmbeddingError);
  });

  it('rejects cross-tenant empty org batches', () => {
    expect(() => assertSingleTenantBatch('', [{ id: '1', text: 'x' }])).toThrow(/organizationId/);
  });

  it('calls embedding service and validates response', async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 1 : 0));
    const fetchImpl = vi.fn(async () =>
      Response.json({
        model: 'embeddinggemma-300m',
        dimensions: 768,
        organizationId: 'org-1',
        embeddings: [{ id: 'c1', embedding: vector, dimensions: 768 }],
      }),
    );
    const client = createEmbeddingClient({
      baseUrl: 'http://embedding.local',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.embed({
      organizationId: 'org-1',
      inputs: [{ id: 'c1', text: 'Pool hours' }],
    });
    expect(result.embeddings[0]?.embedding).toHaveLength(768);
    expect(toPgVectorLiteral(vector).startsWith('[1,')).toBe(true);
  });
});

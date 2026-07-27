import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEmbeddingJobState,
  resetEmbeddingJobStore,
  runEmbeddingJob,
} from './embedding-job.js';

const vector = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));

describe('embedding job', () => {
  beforeEach(() => {
    resetEmbeddingJobStore();
  });

  it('is idempotent and exposes observable ready state', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        model: 'embeddinggemma-300m',
        dimensions: 768,
        organizationId: 'org-1',
        embeddings: [{ id: 'chunk-1', embedding: vector, dimensions: 768 }],
      }),
    );

    const first = await runEmbeddingJob(
      {
        idempotencyKey: 'emb-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        sourceId: 'src-1',
        items: [{ chunkId: 'chunk-1', text: 'Pool hours' }],
      },
      { baseUrl: 'http://embedding.local', fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(first.state).toBe('ready');
    expect(first.idempotentReplay).toBe(false);
    expect(first.vectors[0]?.vectorLiteral).toContain('[');
    expect(getEmbeddingJobState('emb-1')).toBe('ready');

    const second = await runEmbeddingJob(
      {
        idempotencyKey: 'emb-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        sourceId: 'src-1',
        items: [{ chunkId: 'chunk-1', text: 'Pool hours' }],
      },
      { baseUrl: 'http://embedding.local', fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(second.idempotentReplay).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps organization batches isolated in request payload', async () => {
    const fetchImpl = vi.fn(async (_url: URL | Request | string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { organizationId: string };
      expect(body.organizationId).toBe('org-a');
      return Response.json({
        model: 'embeddinggemma-300m',
        dimensions: 768,
        organizationId: 'org-a',
        embeddings: [{ id: 'c1', embedding: vector, dimensions: 768 }],
      });
    });

    const result = await runEmbeddingJob(
      {
        idempotencyKey: 'emb-org',
        organizationId: 'org-a',
        propertyId: 'prop-1',
        sourceId: 'src-1',
        items: [{ chunkId: 'c1', text: 'Wi-Fi' }],
      },
      { baseUrl: 'http://embedding.local', fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.state).toBe('ready');
    expect(result.organizationId).toBe('org-a');
  });
});

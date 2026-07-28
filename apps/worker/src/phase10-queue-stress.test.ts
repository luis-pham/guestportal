import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEmbeddingJobStore, runEmbeddingJob } from './embedding-job.js';
import { resetIngestionIdempotencyStore, runKnowledgeIngestionJob } from './knowledge-ingestion.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evidenceDir = process.env.PHASE10_EVIDENCE_DIR ?? resolve(repoRoot, 'evidence/phase-10/10.2');
const fixturePath = resolve(repoRoot, 'packages/rag/fixtures/sample.txt');
const vector = Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0));

type QueueMetric = {
  name: string;
  jobs: number;
  concurrency: number;
  throughputPerSecond: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  target: { minThroughputPerSecond: number; maxP95Ms: number };
  passed: boolean;
};

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

async function stress(
  input: {
    name: string;
    jobs: number;
    concurrency: number;
    minThroughputPerSecond: number;
    maxP95Ms: number;
  },
  run: (index: number) => Promise<void>,
): Promise<QueueMetric> {
  const durations: number[] = [];
  let next = 0;
  const startedAt = performance.now();

  async function worker() {
    while (next < input.jobs) {
      const index = next;
      next += 1;
      const jobStartedAt = performance.now();
      await run(index);
      durations.push(performance.now() - jobStartedAt);
    }
  }

  await Promise.all(
    Array.from({ length: input.concurrency }, async () => {
      await worker();
    }),
  );

  const elapsedMs = performance.now() - startedAt;
  const throughputPerSecond = (input.jobs / elapsedMs) * 1000;
  const p95Ms = percentile(durations, 95);
  return {
    name: input.name,
    jobs: input.jobs,
    concurrency: input.concurrency,
    throughputPerSecond: round(throughputPerSecond),
    medianMs: round(percentile(durations, 50)),
    p95Ms: round(p95Ms),
    maxMs: round(Math.max(...durations)),
    target: {
      minThroughputPerSecond: input.minThroughputPerSecond,
      maxP95Ms: input.maxP95Ms,
    },
    passed: throughputPerSecond >= input.minThroughputPerSecond && p95Ms < input.maxP95Ms,
  };
}

describe('phase 10.2 queue stress qualification', () => {
  beforeEach(() => {
    resetEmbeddingJobStore();
    resetIngestionIdempotencyStore();
  });

  it('records worker throughput under concurrent ingestion and embedding jobs', async () => {
    const fixture = readFileSync(fixturePath);
    const fetchImpl = vi.fn(async (_url: URL | Request | string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { inputs: Array<{ id: string }> };
      return Response.json({
        model: 'embeddinggemma-300m',
        dimensions: 768,
        organizationId: 'org-phase10',
        embeddings: body.inputs.map((item) => ({
          id: item.id,
          embedding: vector,
          dimensions: 768,
        })),
      });
    });

    const ingestion = await stress(
      {
        name: 'queue.knowledgeIngestion',
        jobs: 120,
        concurrency: 12,
        minThroughputPerSecond: 40,
        maxP95Ms: 250,
      },
      async (index) => {
        const result = await runKnowledgeIngestionJob({
          idempotencyKey: `phase10-ingest-${index}`,
          sourceId: '11111111-1111-4111-8111-111111111111',
          mimeType: 'text/plain',
          filename: 'sample.txt',
          bytes: fixture,
        });
        expect(result.ok).toBe(true);
      },
    );

    const embedding = await stress(
      {
        name: 'queue.embedding',
        jobs: 160,
        concurrency: 16,
        minThroughputPerSecond: 50,
        maxP95Ms: 250,
      },
      async (index) => {
        const result = await runEmbeddingJob(
          {
            idempotencyKey: `phase10-embedding-${index}`,
            organizationId: 'org-phase10',
            propertyId: 'property-phase10',
            sourceId: 'source-phase10',
            items: [{ chunkId: `chunk-${index}`, text: `Pool hours ${index}` }],
          },
          { baseUrl: 'http://embedding.local', fetchImpl: fetchImpl as unknown as typeof fetch },
        );
        expect(result.state).toBe('ready');
      },
    );

    const report = {
      generatedAt: new Date().toISOString(),
      environment: process.env.CI ? 'ci' : 'local',
      targets: {
        minKnowledgeIngestionThroughputPerSecond: 40,
        minEmbeddingThroughputPerSecond: 50,
        maxJobP95Ms: 250,
      },
      metrics: [ingestion, embedding],
      passed: ingestion.passed && embedding.passed,
    };

    mkdirSync(resolve(evidenceDir, 'performance'), { recursive: true });
    writeFileSync(
      resolve(evidenceDir, 'performance/queue-stress.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );

    expect(report.passed).toBe(true);
  });
});

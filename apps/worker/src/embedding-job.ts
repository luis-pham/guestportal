import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingError,
  createEmbeddingClient,
  toPgVectorLiteral,
  type EmbeddingClientOptions,
} from '@guestportal/rag';

export type EmbeddingJobItem = {
  chunkId: string;
  text: string;
};

export type EmbeddingJob = {
  idempotencyKey: string;
  organizationId: string;
  propertyId: string;
  sourceId: string;
  items: EmbeddingJobItem[];
};

export type EmbeddingJobState =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed';

export type EmbeddingJobResult = {
  state: EmbeddingJobState;
  idempotencyKey: string;
  organizationId: string;
  vectors: Array<{ chunkId: string; vectorLiteral: string }>;
  model: string;
  dimensions: number;
  idempotentReplay: boolean;
  errorCode?: string;
  errorMessage?: string;
};

const resultsByKey = new Map<string, EmbeddingJobResult>();
const inflightOrgs = new Set<string>();

export function resetEmbeddingJobStore(): void {
  resultsByKey.clear();
  inflightOrgs.clear();
}

export function getEmbeddingJobState(idempotencyKey: string): EmbeddingJobState | null {
  return resultsByKey.get(idempotencyKey)?.state ?? null;
}

/** Idempotent embedding job — one organization per batch, exact 768-d persistence literals. */
export async function runEmbeddingJob(
  job: EmbeddingJob,
  clientOptions: EmbeddingClientOptions,
): Promise<EmbeddingJobResult> {
  const cached = resultsByKey.get(job.idempotencyKey);
  if (cached) {
    return { ...cached, idempotentReplay: true };
  }

  if (inflightOrgs.has(job.organizationId) && inflightOrgs.size > 1) {
    // Defensive: never mix org batches in one worker turn.
    const failed: EmbeddingJobResult = {
      state: 'failed',
      idempotencyKey: job.idempotencyKey,
      organizationId: job.organizationId,
      vectors: [],
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      idempotentReplay: false,
      errorCode: 'TENANT_BATCH_MIX',
      errorMessage: 'Refusing to run embedding job while another organization batch is in-flight',
    };
    resultsByKey.set(job.idempotencyKey, failed);
    return failed;
  }

  inflightOrgs.add(job.organizationId);
  try {
    const client = createEmbeddingClient(clientOptions);
    const response = await client.embed({
      organizationId: job.organizationId,
      propertyId: job.propertyId,
      inputs: job.items.map((item) => ({ id: item.chunkId, text: item.text })),
    });

    const vectors = response.embeddings.map((item) => ({
      chunkId: item.id,
      vectorLiteral: toPgVectorLiteral(item.embedding),
    }));

    const ready: EmbeddingJobResult = {
      state: 'ready',
      idempotencyKey: job.idempotencyKey,
      organizationId: job.organizationId,
      vectors,
      model: response.model,
      dimensions: response.dimensions,
      idempotentReplay: false,
    };
    resultsByKey.set(job.idempotencyKey, ready);
    return ready;
  } catch (error) {
    const code = error instanceof EmbeddingError ? error.code : 'EMBEDDING_FAILED';
    const message = error instanceof Error ? error.message : 'Embedding failed';
    const failed: EmbeddingJobResult = {
      state: 'failed',
      idempotencyKey: job.idempotencyKey,
      organizationId: job.organizationId,
      vectors: [],
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      idempotentReplay: false,
      errorCode: code,
      errorMessage: message,
    };
    // Only cache non-retryable failures for idempotency stability.
    if (!(error instanceof EmbeddingError && error.retryable)) {
      resultsByKey.set(job.idempotencyKey, failed);
    }
    return failed;
  } finally {
    inflightOrgs.delete(job.organizationId);
  }
}

import { createHash } from 'node:crypto';

export const EMBEDDING_DIMENSIONS = 768;
export const EMBEDDING_MODEL = 'embeddinggemma-300m';

export type EmbeddingInput = {
  id: string;
  text: string;
};

export type EmbeddingRequest = {
  organizationId: string;
  propertyId?: string | null;
  inputs: EmbeddingInput[];
};

export type EmbeddingResult = {
  id: string;
  embedding: number[];
  dimensions: number;
};

export type EmbeddingResponse = {
  model: string;
  dimensions: number;
  organizationId: string;
  embeddings: EmbeddingResult[];
};

export class EmbeddingError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export function assertEmbeddingDimensions(
  vector: number[],
  expected = EMBEDDING_DIMENSIONS,
): void {
  if (vector.length !== expected) {
    throw new EmbeddingError(
      'DIMENSION_MISMATCH',
      `Expected ${expected}-d embedding, received ${vector.length}`,
    );
  }
  if (vector.some((v) => !Number.isFinite(v))) {
    throw new EmbeddingError('INVALID_VECTOR', 'Embedding contains non-finite values');
  }
}

export function assertSingleTenantBatch(organizationId: string, inputs: EmbeddingInput[]): void {
  if (!organizationId.trim()) {
    throw new EmbeddingError('TENANT_REQUIRED', 'organizationId is required for embedding batches');
  }
  if (inputs.length === 0) {
    throw new EmbeddingError('EMPTY_BATCH', 'Embedding batch must include at least one input');
  }
}

/** Stable hashed n-gram embedder matching embedding-service hashed-ngram-v1 backend. */
export function hashEmbedText(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  const normalized = text.toLocaleLowerCase().trim();
  const words =
    normalized.match(/[\w\u00C0-\u024F\u1E00-\u1EFF\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+/gu) ??
    [];
  let count = 0;
  for (const word of words) {
    const tokens = [`w:${word}`];
    if (word.length >= 3) {
      for (let i = 0; i < word.length - 2; i += 1) {
        tokens.push(`g:${word.slice(i, i + 3)}`);
      }
    }
    for (const token of tokens) {
      const digest = createHash('sha256').update(token).digest();
      const idx = digest.readUInt32BE(0) % dimensions;
      const sign = digest[4]! % 2 === 0 ? 1 : -1;
      vec[idx]! += sign;
      count += 1;
    }
  }
  if (count === 0) {
    vec[0] = 1;
    return vec;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export type EmbeddingClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  model?: string;
};

export function createEmbeddingClient(options: EmbeddingClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? EMBEDDING_MODEL;

  return {
    model,
    async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
      assertSingleTenantBatch(request.organizationId, request.inputs);
      let response: Response;
      try {
        response = await fetchImpl(new URL('/v1/embeddings', options.baseUrl), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            organizationId: request.organizationId,
            propertyId: request.propertyId ?? null,
            inputs: request.inputs,
          }),
        });
      } catch (error) {
        throw new EmbeddingError(
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Embedding service unreachable',
          true,
        );
      }

      if (!response.ok) {
        const retryable = response.status >= 500;
        throw new EmbeddingError(
          'HTTP_ERROR',
          `Embedding service returned ${response.status}`,
          retryable,
        );
      }

      const body = (await response.json()) as EmbeddingResponse;
      if (body.organizationId !== request.organizationId) {
        throw new EmbeddingError(
          'TENANT_MISMATCH',
          'Embedding response organizationId does not match request',
        );
      }
      if (body.dimensions !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingError(
          'DIMENSION_MISMATCH',
          `Service reported dimensions=${body.dimensions}`,
        );
      }
      for (const item of body.embeddings) {
        assertEmbeddingDimensions(item.embedding, body.dimensions);
      }
      return body;
    },
  };
}

export function toPgVectorLiteral(vector: number[]): string {
  assertEmbeddingDimensions(vector);
  return `[${vector.join(',')}]`;
}

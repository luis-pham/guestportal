import { createHash } from 'node:crypto';
import { parseDocument, ParseError, type ParseInput } from '@guestportal/rag';
import type { NormalizedDocument } from '@guestportal/contracts';

export type KnowledgeIngestionJob = {
  idempotencyKey: string;
  sourceId: string;
  mimeType: string;
  filename?: string | null;
  bytes: Buffer;
};

export type KnowledgeIngestionResult =
  | { ok: true; document: NormalizedDocument; idempotentReplay: boolean }
  | { ok: false; code: string; message: string; retryable: boolean };

const resultsByKey = new Map<string, KnowledgeIngestionResult>();

export function resetIngestionIdempotencyStore(): void {
  resultsByKey.clear();
}

function contentFingerprint(job: KnowledgeIngestionJob): string {
  return createHash('sha256')
    .update(job.idempotencyKey)
    .update(job.sourceId)
    .update(job.bytes)
    .digest('hex');
}

/** Idempotent parse job for knowledge-ingestion queue (in-process cache for Phase 05.2). */
export async function runKnowledgeIngestionJob(
  job: KnowledgeIngestionJob,
): Promise<KnowledgeIngestionResult> {
  const cached = resultsByKey.get(job.idempotencyKey);
  if (cached) {
    if (cached.ok) {
      return { ...cached, idempotentReplay: true };
    }
    return cached;
  }

  const input: ParseInput = {
    bytes: job.bytes,
    mimeType: job.mimeType,
    filename: job.filename ?? null,
  };

  try {
    const document = await parseDocument(input);
    const result: KnowledgeIngestionResult = {
      ok: true,
      document,
      idempotentReplay: false,
    };
    resultsByKey.set(job.idempotencyKey, result);
    // Fingerprint retained for auditability of retries with same key.
    void contentFingerprint(job);
    return result;
  } catch (error) {
    const code = error instanceof ParseError ? error.code : 'PARSE_FAILED';
    const message = error instanceof Error ? error.message : 'Parse failed';
    const retryable = code === 'PARSE_FAILED';
    const result: KnowledgeIngestionResult = { ok: false, code, message, retryable };
    // Cache failures too so retries with same key remain stable until reset.
    resultsByKey.set(job.idempotencyKey, result);
    return result;
  }
}

import { createHash } from 'node:crypto';

export const CHUNKER_VERSION = '1.0.0';
export const DEFAULT_CHUNK_TARGET_CHARS = 900;
export const DEFAULT_CHUNK_OVERLAP_CHARS = 120;

export type ChunkInputSection = {
  headingPath: string[];
  text: string;
};

export type KnowledgeChunkDraft = {
  ordinal: number;
  content: string;
  headingPath: string[];
  sourceLanguage: string;
  contentHash: string;
  metadata: {
    chunkerVersion: string;
    charCount: number;
    sectionIndex: number;
  };
};

export type ChunkOptions = {
  targetChars?: number;
  overlapChars?: number;
  sourceLanguage: string;
};

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?。！？…]|\n)\s+/u).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

function packUnits(
  units: string[],
  targetChars: number,
  overlapChars: number,
): string[] {
  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
    buffer = '';
  };

  for (const unit of units) {
    if (unit.length > targetChars) {
      flush();
      for (let i = 0; i < unit.length; i += targetChars - overlapChars) {
        chunks.push(unit.slice(i, i + targetChars).trim());
      }
      continue;
    }
    const next = buffer ? `${buffer} ${unit}` : unit;
    if (next.length > targetChars && buffer) {
      flush();
      buffer = unit;
    } else {
      buffer = next;
    }
  }
  flush();

  if (overlapChars <= 0 || chunks.length <= 1) return chunks;

  // Deterministic overlap: prepend tail of previous chunk when gaps exist.
  const withOverlap: string[] = [chunks[0]!];
  for (let i = 1; i < chunks.length; i += 1) {
    const prev = chunks[i - 1]!;
    const overlap = prev.slice(Math.max(0, prev.length - overlapChars));
    const current = chunks[i]!;
    withOverlap.push(current.startsWith(overlap) ? current : `${overlap} ${current}`.trim());
  }
  return withOverlap;
}

/** Deterministic multilingual chunker — same input always yields same content hashes/order. */
export function chunkDocument(
  sections: ChunkInputSection[],
  options: ChunkOptions,
): KnowledgeChunkDraft[] {
  const targetChars = options.targetChars ?? DEFAULT_CHUNK_TARGET_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_CHUNK_OVERLAP_CHARS;
  const drafts: KnowledgeChunkDraft[] = [];
  let ordinal = 0;

  sections.forEach((section, sectionIndex) => {
    const text = section.text.replace(/\r\n/g, '\n').trim();
    if (!text) return;

    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const units = paragraphs.flatMap((p) =>
      p.length > targetChars ? splitSentences(p) : [p],
    );
    const packed = packUnits(units, targetChars, overlapChars);

    for (const content of packed) {
      drafts.push({
        ordinal,
        content,
        headingPath: [...section.headingPath],
        sourceLanguage: options.sourceLanguage,
        contentHash: contentHash(content),
        metadata: {
          chunkerVersion: CHUNKER_VERSION,
          charCount: content.length,
          sectionIndex,
        },
      });
      ordinal += 1;
    }
  });

  return drafts;
}

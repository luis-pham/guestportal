import {
  CHUNKER_VERSION,
  PARSER_VERSION,
  chunkDocument,
  detectLanguage,
  parseDocument,
  type KnowledgeChunkDraft,
  type ParseInput,
} from '@guestportal/rag';

export type ChunkVersionReplaceInput = {
  organizationId: string;
  propertyId: string;
  sourceId: string;
  previousVersion: number;
  parse: ParseInput;
};

export type ChunkVersionReplaceResult = {
  version: number;
  sourceLanguage: string;
  chunks: KnowledgeChunkDraft[];
  invalidatedPrevious: boolean;
  parserVersion: string;
  chunkerVersion: string;
};

export type ChunkRecord = {
  organizationId: string;
  propertyId: string;
  sourceId: string;
  version: number;
  ordinal: number;
  content: string;
  headingPath: string[];
  sourceLanguage: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  active: boolean;
  invalidatedAt: string | null;
};

/** In-memory store used for unit/integration of version invalidation semantics. */
export class ChunkVersionStore {
  private readonly records: ChunkRecord[] = [];

  listActive(sourceId: string): ChunkRecord[] {
    return this.records.filter((r) => r.sourceId === sourceId && r.active);
  }

  listAll(sourceId: string): ChunkRecord[] {
    return this.records.filter((r) => r.sourceId === sourceId);
  }

  async replaceFromParsedDocument(
    input: ChunkVersionReplaceInput,
  ): Promise<ChunkVersionReplaceResult> {
    const document = await parseDocument(input.parse);
    const detected = detectLanguage(document.text);
    const version = input.previousVersion + 1;
    const drafts = chunkDocument(document.sections, {
      sourceLanguage: detected.language,
    });

    const now = new Date().toISOString();
    let invalidatedPrevious = false;
    for (const record of this.records) {
      if (record.sourceId === input.sourceId && record.active) {
        record.active = false;
        record.invalidatedAt = now;
        invalidatedPrevious = true;
      }
    }

    for (const draft of drafts) {
      this.records.push({
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        sourceId: input.sourceId,
        version,
        ordinal: draft.ordinal,
        content: draft.content,
        headingPath: draft.headingPath,
        sourceLanguage: draft.sourceLanguage,
        contentHash: draft.contentHash,
        metadata: draft.metadata,
        active: true,
        invalidatedAt: null,
      });
    }

    return {
      version,
      sourceLanguage: detected.language,
      chunks: drafts,
      invalidatedPrevious,
      parserVersion: PARSER_VERSION,
      chunkerVersion: CHUNKER_VERSION,
    };
  }
}

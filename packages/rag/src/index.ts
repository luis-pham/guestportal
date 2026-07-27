export { parseDocument, type ParseInput } from './parse.js';
export {
  PARSER_VERSION,
  ParseError,
  buildNormalizedDocument,
  checksumSha256,
  collapseWhitespace,
} from './normalize.js';
export { htmlToText } from './html.js';
export {
  CHUNKER_VERSION,
  DEFAULT_CHUNK_OVERLAP_CHARS,
  DEFAULT_CHUNK_TARGET_CHARS,
  chunkDocument,
  type ChunkInputSection,
  type ChunkOptions,
  type KnowledgeChunkDraft,
} from './chunk.js';
export { detectLanguage, type DetectedLanguage } from './language.js';
export {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingError,
  assertEmbeddingDimensions,
  assertSingleTenantBatch,
  createEmbeddingClient,
  toPgVectorLiteral,
  hashEmbedText,
  type EmbeddingClientOptions,
  type EmbeddingInput,
  type EmbeddingRequest,
  type EmbeddingResponse,
  type EmbeddingResult,
} from './embeddings.js';
export {
  computeRecallAtK,
  fuseRankedChannels,
  sanitizeRetrievalQuery,
  toCitations,
  type ChannelHit,
  type Citation,
  type RankedHit,
} from './retrieval.js';

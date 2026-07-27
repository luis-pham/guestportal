import { z } from 'zod';

export const knowledgeSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  locale: z.enum(['vi', 'en', 'ko', 'ja', 'zh', 'fr', 'auto']).default('auto'),
  limit: z.number().int().min(1).max(20).default(8),
});

export const knowledgeCitationSchema = z.object({
  sourceId: z.string().uuid(),
  chunkId: z.string().uuid(),
  title: z.string(),
  headingPath: z.array(z.string()),
  excerpt: z.string(),
  score: z.number(),
});

export const knowledgeSearchHitSchema = z.object({
  chunkId: z.string().uuid(),
  sourceId: z.string().uuid(),
  content: z.string(),
  headingPath: z.array(z.string()),
  sourceLanguage: z.string(),
  score: z.number(),
  channels: z.array(z.enum(['vector', 'fts', 'trgm'])),
});

export const knowledgeSearchResponseSchema = z.object({
  query: z.string(),
  sanitizedQuery: z.string(),
  blocked: z.boolean(),
  hits: z.array(knowledgeSearchHitSchema),
  citations: z.array(knowledgeCitationSchema),
  noResult: z.boolean(),
});

export type KnowledgeSearchRequest = z.infer<typeof knowledgeSearchRequestSchema>;
export type KnowledgeSearchResponse = z.infer<typeof knowledgeSearchResponseSchema>;

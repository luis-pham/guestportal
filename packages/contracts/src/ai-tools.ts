import { z } from 'zod';
import { knowledgeSearchResponseSchema } from './knowledge-search.js';

export const aiToolNameSchema = z.enum([
  'knowledge.search',
  'catalog.read',
  'service.read',
]);

export const aiToolScopeSchema = z.object({
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  guestSessionId: z.string().uuid(),
  conversationId: z.string().uuid(),
  locale: z.string().trim().min(2).max(16),
});

export const knowledgeSearchToolInputSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  locale: z.enum(['vi', 'en', 'ko', 'ja', 'zh', 'fr', 'auto']).default('auto'),
  limit: z.number().int().min(1).max(8).default(5),
});

export const localizedToolTextSchema = z.object({
  vi: z.string(),
  en: z.string(),
});

export const catalogToolItemSchema = z.object({
  id: z.string(),
  type: z.enum(['action', 'service', 'schedule', 'guide', 'promotion', 'contact']),
  label: localizedToolTextSchema,
  body: localizedToolTextSchema.nullable(),
  href: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const catalogReadToolInputSchema = z.object({
  locale: z.enum(['vi', 'en', 'auto']).default('auto'),
  limit: z.number().int().min(1).max(20).default(12),
});

export const catalogReadToolOutputSchema = z.object({
  propertyId: z.string().uuid(),
  locale: z.string(),
  items: z.array(catalogToolItemSchema),
  noResult: z.boolean(),
});

export const serviceReadToolInputSchema = z.object({
  locale: z.enum(['vi', 'en', 'auto']).default('auto'),
  limit: z.number().int().min(1).max(12).default(8),
});

export const serviceReadToolOutputSchema = z.object({
  propertyId: z.string().uuid(),
  locale: z.string(),
  services: z.array(catalogToolItemSchema),
  noResult: z.boolean(),
});

export const aiToolInputSchemas = {
  'knowledge.search': knowledgeSearchToolInputSchema,
  'catalog.read': catalogReadToolInputSchema,
  'service.read': serviceReadToolInputSchema,
} as const;

export const aiToolOutputSchemas = {
  'knowledge.search': knowledgeSearchResponseSchema,
  'catalog.read': catalogReadToolOutputSchema,
  'service.read': serviceReadToolOutputSchema,
} as const;

export const guestAiToolExecuteRequestSchema = z.object({
  toolName: aiToolNameSchema,
  input: z.record(z.unknown()),
});

export const guestAiToolExecuteResponseSchema = z.object({
  toolName: aiToolNameSchema,
  result: z.record(z.unknown()),
});

export type AiToolName = z.infer<typeof aiToolNameSchema>;
export type AiToolScope = z.infer<typeof aiToolScopeSchema>;
export type KnowledgeSearchToolInput = z.infer<typeof knowledgeSearchToolInputSchema>;
export type CatalogReadToolInput = z.infer<typeof catalogReadToolInputSchema>;
export type CatalogToolItem = z.infer<typeof catalogToolItemSchema>;
export type CatalogReadToolOutput = z.infer<typeof catalogReadToolOutputSchema>;
export type ServiceReadToolInput = z.infer<typeof serviceReadToolInputSchema>;
export type ServiceReadToolOutput = z.infer<typeof serviceReadToolOutputSchema>;
export type GuestAiToolExecuteRequest = z.infer<typeof guestAiToolExecuteRequestSchema>;
export type GuestAiToolExecuteResponse = z.infer<typeof guestAiToolExecuteResponseSchema>;

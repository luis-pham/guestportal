import { z } from 'zod';

export const knowledgeSourceTypeSchema = z.enum(['file', 'manual', 'url']);

export const knowledgeSourceStatusSchema = z.enum([
  'draft',
  'pending_upload',
  'uploaded',
  'queued',
  'processing',
  'ready',
  'published',
  'failed',
]);

export const knowledgeSourceCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: knowledgeSourceTypeSchema.default('file'),
  sourceLanguage: z.enum(['vi', 'en', 'ko', 'ja', 'auto']).optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
});

export const knowledgeSourceUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    sourceLanguage: z.enum(['vi', 'en', 'ko', 'ja', 'auto']).nullable().optional(),
    assetId: z.string().uuid().nullable().optional(),
    status: z.enum(['draft', 'failed']).optional(),
    errorCode: z.string().trim().max(80).nullable().optional(),
    errorMessage: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.sourceLanguage !== undefined ||
      value.assetId !== undefined ||
      value.status !== undefined ||
      value.errorCode !== undefined ||
      value.errorMessage !== undefined,
    { message: 'At least one field is required' },
  );

export const knowledgeSourceSummarySchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  type: knowledgeSourceTypeSchema,
  title: z.string(),
  sourceLanguage: z.string().nullable(),
  assetId: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  status: knowledgeSourceStatusSchema,
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  originalFilename: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeSourceCreateInput = z.infer<typeof knowledgeSourceCreateSchema>;
export type KnowledgeSourceUpdateInput = z.infer<typeof knowledgeSourceUpdateSchema>;
export type KnowledgeSourceSummary = z.infer<typeof knowledgeSourceSummarySchema>;
export type KnowledgeSourceStatus = z.infer<typeof knowledgeSourceStatusSchema>;

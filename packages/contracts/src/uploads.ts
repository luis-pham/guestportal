import { z } from 'zod';

export const uploadPurposeSchema = z.enum(['branding_logo', 'branding_cover', 'knowledge_source']);

const brandingImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;
const knowledgeSourceMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/html',
  'text/markdown',
] as const;

export const uploadPresignRequestSchema = z
  .object({
    purpose: uploadPurposeSchema,
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(200),
    sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
    propertyId: z.string().uuid(),
  })
  .superRefine((value, ctx) => {
    const allowed =
      value.purpose === 'knowledge_source'
        ? (knowledgeSourceMimeTypes as readonly string[])
        : (brandingImageMimeTypes as readonly string[]);
    if (!allowed.includes(value.mimeType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mimeType'],
        message: `Unsupported content type: ${value.mimeType}`,
      });
    }
  });

export const uploadCompleteRequestSchema = z.object({
  assetId: z.string().uuid(),
});

export type UploadPresignRequest = z.infer<typeof uploadPresignRequestSchema>;
export type UploadCompleteRequest = z.infer<typeof uploadCompleteRequestSchema>;

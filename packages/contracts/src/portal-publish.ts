import { z } from 'zod';
import { portalConfigDocumentSchema } from './portal.js';

export const portalPublishRequestSchema = z.object({
  expectedDraftVersion: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export const portalVersionSummarySchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  checksumSha256: z.string(),
  publishedAt: z.string().datetime(),
  publishedBy: z.string().uuid().nullable(),
  restoredFromVersionId: z.string().uuid().nullable(),
  note: z.string().nullable(),
});

export const portalRestoreRequestSchema = z.object({
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export type PortalPublishRequest = z.infer<typeof portalPublishRequestSchema>;
export type PortalRestoreRequest = z.infer<typeof portalRestoreRequestSchema>;

export { portalConfigDocumentSchema };

import { z } from 'zod';
import { portalConfigDocumentSchema, portalNavItemSchema } from './portal.js';

export const portalPreviewDeviceSchema = z.enum(['phone', 'tablet', 'desktop']);
export const portalPreviewLocaleSchema = z.enum(['vi', 'en']);

export const portalPreviewQuerySchema = z.object({
  locale: portalPreviewLocaleSchema.default('en'),
  device: portalPreviewDeviceSchema.default('phone'),
  locationId: z.string().uuid().optional(),
});

export const portalLocationSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  code: z.string().min(1).max(64),
  name: z.object({
    vi: z.string(),
    en: z.string(),
  }),
});

export const portalPreviewResponseSchema = z.object({
  propertyId: z.string().uuid(),
  version: z.number().int().positive(),
  locale: portalPreviewLocaleSchema,
  device: portalPreviewDeviceSchema,
  location: portalLocationSchema.nullable(),
  config: portalConfigDocumentSchema,
  source: z.literal('draft'),
});

export const portalNavUpdateSchema = z.object({
  version: z.number().int().positive(),
  primaryNavigation: z.array(portalNavItemSchema).max(12),
  secondaryNavigation: z.array(portalNavItemSchema).max(12),
});

export type PortalPreviewDevice = z.infer<typeof portalPreviewDeviceSchema>;
export type PortalPreviewLocale = z.infer<typeof portalPreviewLocaleSchema>;
export type PortalLocation = z.infer<typeof portalLocationSchema>;
export type PortalNavUpdateInput = z.infer<typeof portalNavUpdateSchema>;

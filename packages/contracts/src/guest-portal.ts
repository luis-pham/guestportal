import { z } from 'zod';
import { propertyBrandingSchema } from './branding.js';
import { portalConfigDocumentSchema } from './portal.js';
import { qrDestinationTypeSchema } from './qr.js';

export const guestPortalResponseSchema = z.object({
  locale: z.string(),
  property: z.object({
    name: z.string(),
    slug: z.string(),
    timezone: z.string(),
    defaultLocale: z.string(),
    supportedLocales: z.array(z.string()),
  }),
  location: z.object({
    code: z.string(),
    name: z.object({ vi: z.string(), en: z.string() }),
  }),
  destination: z.object({
    type: qrDestinationTypeSchema,
  }),
  branding: propertyBrandingSchema.extend({
    logoUrl: z.string().url().nullable(),
    coverUrl: z.string().url().nullable(),
  }),
  portal: z.object({
    versionNumber: z.number().int().positive(),
    publishedAt: z.string().datetime(),
    config: portalConfigDocumentSchema,
  }),
  fallbacks: z.object({
    missingLogo: z.boolean(),
    missingCover: z.boolean(),
  }),
});

export type GuestPortalResponse = z.infer<typeof guestPortalResponseSchema>;

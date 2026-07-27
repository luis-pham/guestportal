import { z } from 'zod';

export const qrDestinationTypeSchema = z.enum([
  'portal_home',
  'guide',
  'explore',
  'catalog',
  'request',
]);

export const qrCreateRequestSchema = z.object({
  locationId: z.string().uuid(),
  destinationType: qrDestinationTypeSchema.default('portal_home'),
  destinationId: z.string().uuid().nullable().optional(),
});

export const qrUpdateRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    locationId: z.string().uuid().optional(),
    destinationType: qrDestinationTypeSchema.optional(),
    destinationId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.enabled !== undefined ||
      value.locationId !== undefined ||
      value.destinationType !== undefined ||
      value.destinationId !== undefined,
    { message: 'At least one field is required' },
  );

export const qrDownloadFormatSchema = z.enum(['svg', 'png']);

export const qrResolveRequestSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

export const qrCodeSummarySchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  locationId: z.string().uuid(),
  destinationType: qrDestinationTypeSchema,
  destinationId: z.string().uuid().nullable(),
  enabled: z.boolean(),
  scanCount: z.number().int().nonnegative(),
  lastScannedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const qrResolveResponseSchema = z.object({
  valid: z.literal(true),
  guestPath: z.string(),
  property: z.object({
    name: z.string(),
    slug: z.string(),
    timezone: z.string(),
    defaultLocale: z.string(),
    supportedLocales: z.array(z.string()),
  }),
  location: z.object({
    code: z.string(),
    name: z.object({
      vi: z.string(),
      en: z.string(),
    }),
  }),
  destination: z.object({
    type: qrDestinationTypeSchema,
  }),
});

export type QrCreateRequest = z.infer<typeof qrCreateRequestSchema>;
export type QrUpdateRequest = z.infer<typeof qrUpdateRequestSchema>;
export type QrResolveRequest = z.infer<typeof qrResolveRequestSchema>;
export type QrCodeSummary = z.infer<typeof qrCodeSummarySchema>;
export type QrDestinationType = z.infer<typeof qrDestinationTypeSchema>;

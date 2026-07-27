import { z } from 'zod';
import { qrDestinationTypeSchema } from './qr.js';

export const guestSessionCreateRequestSchema = z.object({
  token: z.string().trim().min(16).max(128),
  locale: z.enum(['vi', 'en']).optional(),
});

export const guestPublicContextSchema = z.object({
  locale: z.string(),
  expiresAt: z.string().datetime(),
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

export type GuestSessionCreateRequest = z.infer<typeof guestSessionCreateRequestSchema>;
export type GuestPublicContext = z.infer<typeof guestPublicContextSchema>;

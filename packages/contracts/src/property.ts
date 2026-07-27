import { z } from 'zod';

export const propertyTypeSchema = z.enum([
  'hotel',
  'resort',
  'cruise',
  'airbnb',
  'serviced_apartment',
  'restaurant',
  'spa',
  'other',
]);

export const propertyStatusSchema = z.enum(['active', 'suspended']);

export const propertyCreateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
  type: propertyTypeSchema,
  timezone: z.string().trim().min(1).max(64),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Currency must be ISO-4217 uppercase'),
  defaultLocale: z.string().trim().min(2).max(16),
  supportedLocales: z.array(z.string().trim().min(2).max(16)).min(1),
});

export const propertySettingsUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: propertyStatusSchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/, 'Currency must be ISO-4217 uppercase')
      .optional(),
    defaultLocale: z.string().trim().min(2).max(16).optional(),
    supportedLocales: z.array(z.string().trim().min(2).max(16)).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one property setting field is required',
  });

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type PropertySettingsUpdateInput = z.infer<typeof propertySettingsUpdateSchema>;

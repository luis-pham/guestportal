import { z } from 'zod';

/** Hex color for guest-facing brand tokens. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hex value');

/**
 * Branding configuration for a property.
 * Logo/cover asset IDs reference rows created by the R2 upload pipeline.
 */
export const propertyBrandingSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  primaryColor: hexColorSchema,
  primaryHoverColor: hexColorSchema,
  accentColor: hexColorSchema.nullable(),
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  logoAssetId: z.string().uuid().nullable(),
  coverAssetId: z.string().uuid().nullable(),
  fontFamily: z.enum(['system', 'serif', 'sans', 'display']).default('sans'),
});

export const propertyBrandingUpdateSchema = propertyBrandingSchema;

export type PropertyBranding = z.infer<typeof propertyBrandingSchema>;
export type PropertyBrandingUpdateInput = z.infer<typeof propertyBrandingUpdateSchema>;

export const defaultPropertyBranding = (): PropertyBranding => ({
  displayName: 'Guest Portal',
  primaryColor: '#0F766E',
  primaryHoverColor: '#0D9488',
  accentColor: '#F59E0B',
  backgroundColor: '#FFFFFF',
  textColor: '#111827',
  logoAssetId: null,
  coverAssetId: null,
  fontFamily: 'sans',
});

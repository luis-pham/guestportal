import { describe, expect, it } from 'vitest';
import { defaultPropertyBranding, propertyBrandingSchema } from './branding.js';
import { propertySettingsUpdateSchema } from './property.js';

describe('property and branding contracts', () => {
  it('accepts default branding', () => {
    const parsed = propertyBrandingSchema.parse(defaultPropertyBranding());
    expect(parsed.primaryColor).toBe('#0F766E');
    expect(parsed.logoAssetId).toBeNull();
  });

  it('rejects invalid hex colors', () => {
    expect(() =>
      propertyBrandingSchema.parse({
        ...defaultPropertyBranding(),
        primaryColor: 'teal',
      }),
    ).toThrow();
  });

  it('requires at least one property settings field', () => {
    expect(() => propertySettingsUpdateSchema.parse({})).toThrow();
    expect(propertySettingsUpdateSchema.parse({ timezone: 'Asia/Ho_Chi_Minh' }).timezone).toBe(
      'Asia/Ho_Chi_Minh',
    );
  });
});

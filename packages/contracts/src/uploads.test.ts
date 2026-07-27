import { describe, expect, it } from 'vitest';
import { uploadPresignRequestSchema } from './uploads.js';

describe('uploadPresignRequestSchema', () => {
  it('accepts branding image uploads', () => {
    const parsed = uploadPresignRequestSchema.parse({
      purpose: 'branding_logo',
      filename: 'logo.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      propertyId: '11111111-1111-4111-8111-111111111111',
    });
    expect(parsed.purpose).toBe('branding_logo');
  });

  it('rejects invalid mime types', () => {
    expect(() =>
      uploadPresignRequestSchema.parse({
        purpose: 'branding_cover',
        filename: 'x.gif',
        mimeType: 'image/gif',
        sizeBytes: 100,
        propertyId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow();
  });
});

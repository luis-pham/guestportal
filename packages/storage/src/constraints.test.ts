import { describe, expect, it } from 'vitest';
import { validateUploadConstraints } from './constraints.js';

describe('validateUploadConstraints', () => {
  it('accepts valid logo png', () => {
    expect(
      validateUploadConstraints({
        purpose: 'branding_logo',
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects unsupported mime and oversized files', () => {
    expect(
      validateUploadConstraints({
        purpose: 'branding_logo',
        mimeType: 'application/pdf',
        sizeBytes: 100,
      }).ok,
    ).toBe(false);
    expect(
      validateUploadConstraints({
        purpose: 'branding_cover',
        mimeType: 'image/jpeg',
        sizeBytes: 6 * 1024 * 1024,
      }).code,
    ).toBe('FILE_TOO_LARGE');
  });

  it('accepts knowledge source PDF within size limit', () => {
    expect(
      validateUploadConstraints({
        purpose: 'knowledge_source',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: true });
    expect(
      validateUploadConstraints({
        purpose: 'knowledge_source',
        mimeType: 'image/png',
        sizeBytes: 100,
      }).code,
    ).toBe('UNSUPPORTED_MIME');
  });
});
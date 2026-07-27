export const BRANDING_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type BrandingImageMimeType = (typeof BRANDING_IMAGE_MIME_TYPES)[number];

export const KNOWLEDGE_SOURCE_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/html',
  'text/markdown',
] as const;

export type KnowledgeSourceMimeType = (typeof KNOWLEDGE_SOURCE_MIME_TYPES)[number];

export const UPLOAD_PURPOSES = ['branding_logo', 'branding_cover', 'knowledge_source'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const MAX_BYTES_BY_PURPOSE: Record<UploadPurpose, number> = {
  branding_logo: 2 * 1024 * 1024,
  branding_cover: 5 * 1024 * 1024,
  knowledge_source: 25 * 1024 * 1024,
};

export const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export type UploadConstraintResult =
  | { ok: true }
  | { ok: false; code: 'UNSUPPORTED_MIME' | 'FILE_TOO_LARGE' | 'INVALID_PURPOSE'; message: string };

export function validateUploadConstraints(input: {
  purpose: string;
  mimeType: string;
  sizeBytes: number;
}): UploadConstraintResult {
  if (!UPLOAD_PURPOSES.includes(input.purpose as UploadPurpose)) {
    return {
      ok: false,
      code: 'INVALID_PURPOSE',
      message: `Unsupported upload purpose: ${input.purpose}`,
    };
  }
  const purpose = input.purpose as UploadPurpose;
  const allowedMime =
    purpose === 'knowledge_source'
      ? (KNOWLEDGE_SOURCE_MIME_TYPES as readonly string[])
      : (BRANDING_IMAGE_MIME_TYPES as readonly string[]);

  if (!allowedMime.includes(input.mimeType)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MIME',
      message: `Unsupported content type: ${input.mimeType}. Allowed: ${allowedMime.join(', ')}`,
    };
  }
  const max = MAX_BYTES_BY_PURPOSE[purpose];
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, code: 'FILE_TOO_LARGE', message: 'sizeBytes must be a positive number.' };
  }
  if (input.sizeBytes > max) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `File exceeds max size of ${max} bytes for purpose ${purpose}.`,
    };
  }
  return { ok: true };
}

export type AssetObjectKeyInput = {
  organizationId: string;
  propertyId: string;
  purpose: string;
  assetId: string;
  filename: string;
};

/** Sanitize filename to a safe object-key segment. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'file';
}

/**
 * Tenant/property-scoped object key.
 * Format: org/{orgId}/property/{propertyId}/{purpose}/{assetId}/{filename}
 */
export function buildAssetObjectKey(input: AssetObjectKeyInput): string {
  const filename = sanitizeFilename(input.filename);
  return [
    'org',
    input.organizationId,
    'property',
    input.propertyId,
    input.purpose,
    input.assetId,
    filename,
  ].join('/');
}

export function buildPublicUrl(publicBaseUrl: string, objectKey: string): string {
  const base = publicBaseUrl.replace(/\/+$/, '');
  const key = objectKey.replace(/^\/+/, '');
  return `${base}/${key}`;
}

/** Disposable prefix for Task 03.2 REAL_STAGING verification. */
export const TASK_032_TEST_PREFIX = 'test/task-03-2';

export function buildStagingTestKey(suffix: string): string {
  const safe = suffix.replace(/^\/+/, '').replace(/\.\./g, '');
  return `${TASK_032_TEST_PREFIX}/${safe}`;
}

export function assertKeyBelongsToTenant(
  objectKey: string,
  organizationId: string,
  propertyId?: string,
): boolean {
  const expectedOrg = `org/${organizationId}/`;
  if (!objectKey.startsWith(expectedOrg)) {
    return false;
  }
  if (propertyId) {
    return objectKey.startsWith(`${expectedOrg}property/${propertyId}/`);
  }
  return true;
}

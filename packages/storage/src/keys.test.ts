import { describe, expect, it } from 'vitest';
import {
  assertKeyBelongsToTenant,
  buildAssetObjectKey,
  buildPublicUrl,
  buildStagingTestKey,
  sanitizeFilename,
} from './keys.js';

describe('object keys', () => {
  it('builds tenant/property scoped keys', () => {
    const key = buildAssetObjectKey({
      organizationId: 'org-1',
      propertyId: 'prop-1',
      purpose: 'branding_logo',
      assetId: 'asset-1',
      filename: 'Logo Soft.png',
    });
    expect(key).toBe('org/org-1/property/prop-1/branding_logo/asset-1/Logo_Soft.png');
  });

  it('sanitizes unsafe filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
  });

  it('rejects cross-tenant keys', () => {
    expect(
      assertKeyBelongsToTenant('org/org-a/property/p1/branding_logo/a/x.png', 'org-b'),
    ).toBe(false);
    expect(
      assertKeyBelongsToTenant('org/org-a/property/p1/branding_logo/a/x.png', 'org-a', 'p2'),
    ).toBe(false);
    expect(
      assertKeyBelongsToTenant('org/org-a/property/p1/branding_logo/a/x.png', 'org-a', 'p1'),
    ).toBe(true);
  });

  it('builds public URLs and staging keys', () => {
    expect(buildPublicUrl('https://cdn.test/', 'a/b.png')).toBe('https://cdn.test/a/b.png');
    expect(buildStagingTestKey('probe.png')).toBe('test/task-03-2/probe.png');
  });
});

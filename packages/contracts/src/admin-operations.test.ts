import { describe, expect, it } from 'vitest';
import {
  adminTeamMemberUpdateSchema,
  organizationAdminSettingsUpdateSchema,
} from './admin-operations.js';

describe('admin operations contracts', () => {
  it('requires explicit confirmation for team member revocation', () => {
    expect(
      adminTeamMemberUpdateSchema.parse({
        status: 'revoked',
        confirm: true,
      }),
    ).toMatchObject({ status: 'revoked', confirm: true });
    expect(() => adminTeamMemberUpdateSchema.parse({ status: 'revoked' })).toThrow();
  });

  it('validates organization settings updates', () => {
    expect(
      organizationAdminSettingsUpdateSchema.parse({
        name: 'Aurora Hospitality',
        defaultLocale: 'en',
      }),
    ).toMatchObject({ defaultLocale: 'en' });
    expect(() => organizationAdminSettingsUpdateSchema.parse({})).toThrow();
    expect(() =>
      organizationAdminSettingsUpdateSchema.parse({ name: '', defaultLocale: 'fr' }),
    ).toThrow();
  });
});

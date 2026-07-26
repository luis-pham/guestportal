import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, permissionScope, roleHasPermission } from './roles.js';
import { can, type AuthzContext } from './authorize.js';

describe('permission matrix', () => {
  for (const role of ROLES.filter((r) => r !== 'platform_admin')) {
    for (const permission of PERMISSIONS) {
      it(`${role}.${permission} matches documented grant semantics`, () => {
        const scope = permissionScope(role, permission);
        const allowed = roleHasPermission(role, permission);
        if (scope === false) {
          expect(allowed).toBe(false);
        } else {
          expect(allowed).toBe(true);
        }
      });
    }
  }

  it('denies cross-property access for property managers', () => {
    const ctx: AuthzContext = {
      userId: 'u1',
      role: 'property_manager',
      organizationId: 'org1',
      assignedPropertyIds: ['prop-a'],
    };
    expect(can(ctx, 'property.read', 'prop-a')).toBe(true);
    expect(can(ctx, 'property.read', 'prop-b')).toBe(false);
    expect(can(ctx, 'organization.update')).toBe(false);
  });

  it('allows organization owners org-wide', () => {
    const ctx: AuthzContext = {
      userId: 'u1',
      role: 'organization_owner',
      organizationId: 'org1',
      assignedPropertyIds: [],
    };
    expect(can(ctx, 'property.read', 'any')).toBe(true);
    expect(can(ctx, 'team.manage')).toBe(true);
  });
});

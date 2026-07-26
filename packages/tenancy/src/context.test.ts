import { describe, expect, it } from 'vitest';
import { filterPropertyScope, type TenantContext } from './context.js';

describe('tenant context', () => {
  it('scopes property managers to assigned properties', () => {
    const ctx: TenantContext = {
      organizationId: 'org-a',
      propertyIds: ['p1'],
      actorType: 'staff',
      role: 'property_manager',
    };
    expect(filterPropertyScope(ctx, 'p1')).toBe(true);
    expect(filterPropertyScope(ctx, 'p2')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { shellLayout } from '@guestportal/ui';
import { roleHasPermission } from '../../../packages/auth/src/roles';

describe('staff-web foundation', () => {
  it('uses shared shell layout tokens', () => {
    expect(shellLayout.primarySidebarCollapsed).toBe(68);
  });

  it('gates staff workspace on request.read', () => {
    expect(roleHasPermission('staff', 'request.read')).toBe(true);
    expect(roleHasPermission('content_manager', 'request.read')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { shellLayout } from '@guestportal/ui';

describe('staff-web foundation', () => {
  it('uses shared shell layout tokens', () => {
    expect(shellLayout.primarySidebarCollapsed).toBe(68);
  });
});

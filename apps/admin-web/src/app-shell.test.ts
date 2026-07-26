import { describe, expect, it } from 'vitest';
import { shellLayout } from '@guestportal/ui';

describe('admin-web foundation', () => {
  it('uses shared shell layout tokens', () => {
    expect(shellLayout.primarySidebarExpanded).toBe(240);
  });
});

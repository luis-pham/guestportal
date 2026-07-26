import { describe, expect, it } from 'vitest';
import { colorTokens, shellLayout, spacingScale } from './tokens';

describe('design tokens', () => {
  it('exposes the required spacing scale', () => {
    expect(spacingScale).toEqual([2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
  });

  it('matches documented sidebar widths', () => {
    expect(shellLayout.primarySidebarExpanded).toBe(240);
    expect(shellLayout.primarySidebarCollapsed).toBe(68);
  });

  it('includes semantic brand tokens', () => {
    expect(colorTokens).toContain('brand');
    expect(colorTokens).toContain('focus-ring');
  });
});

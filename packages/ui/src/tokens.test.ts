import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { guestPortalTailwindTheme } from './tailwind-theme.js';
import {
  colorTokens,
  cssVarForColor,
  cssVarForSpace,
  lightColorValues,
  motion,
  shadows,
  shellLayout,
  spacingScale,
  themeExtensionPoints,
  typography,
  typographyRoles,
  typographySamples,
} from './tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(here, 'tokens.css'), 'utf8');

describe('design tokens', () => {
  it('exposes the required spacing scale', () => {
    expect(spacingScale).toEqual([2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
  });

  it('matches documented sidebar widths', () => {
    expect(shellLayout.primarySidebarExpanded).toBe(256);
    expect(shellLayout.primarySidebarCollapsed).toBe(64);
    expect(shellLayout.secondarySidebarMin).toBe(240);
    expect(shellLayout.secondarySidebarMax).toBe(280);
  });

  it('includes semantic color tokens with light values', () => {
    for (const token of colorTokens) {
      expect(lightColorValues[token]).toMatch(/^#/);
      expect(tokensCss).toContain(`--gp-color-${token}:`);
      expect(cssVarForColor(token)).toBe(`var(--gp-color-${token})`);
    }
  });

  it('uses semantic names rather than page-specific names', () => {
    const joined = colorTokens.join(' ');
    expect(joined).not.toMatch(/login|dashboard|invoice|billing|plan/i);
  });

  it('defines typography roles and Vietnamese-capable font stacks', () => {
    expect(typographyRoles).toEqual([
      'display',
      'h1',
      'h2',
      'h3',
      'body',
      'body-small',
      'label',
      'caption',
      'mono',
    ]);
    expect(typography.fontFamily.sans).toContain('Hanken Grotesk');
    expect(typography.fontFamily.sans).toContain('Be Vietnam Pro');
    expect(typography.fontFamily.sans).toContain('Noto Sans');
    expect(typography.fontFamily.display).toContain('Newsreader');
    expect(tokensCss).toContain('Be Vietnam Pro');
    expect(typographySamples.vi).toMatch(/[ăâêôơưđáàảãạ]/i);
  });

  it('exposes shadow and motion tokens in CSS', () => {
    for (const key of Object.keys(shadows)) {
      expect(tokensCss).toContain(`--gp-shadow-${key}:`);
    }
    for (const key of Object.keys(motion.duration)) {
      expect(tokensCss).toContain(`--gp-duration-${key}:`);
    }
    for (const key of Object.keys(motion.easing)) {
      expect(tokensCss).toContain(`--gp-easing-${key}:`);
    }
  });

  it('documents theme extension points', () => {
    expect(themeExtensionPoints.defaultTheme).toBe('light');
    expect(themeExtensionPoints.themeAttribute).toBe('data-theme');
    expect(themeExtensionPoints.guestBrandOverrides).toContain('--gp-color-brand');
    expect(tokensCss).toContain("[data-theme='light']");
    expect(tokensCss).toContain("[data-surface='guest'][data-property-brand]");
  });

  it('maps Tailwind theme colors/spacing to CSS variables', () => {
    expect(guestPortalTailwindTheme.colors.gp.brand).toBe('var(--gp-color-brand)');
    expect(guestPortalTailwindTheme.spacing['16']).toBe(cssVarForSpace(16));
    expect(guestPortalTailwindTheme.borderRadius.md).toBe('var(--gp-radius-md)');
    expect(guestPortalTailwindTheme.boxShadow.md).toBe('var(--gp-shadow-md)');
    expect(guestPortalTailwindTheme.transitionDuration.normal).toBe('var(--gp-duration-normal)');
    expect(guestPortalTailwindTheme.width['sidebar-expanded']).toBe('var(--gp-sidebar-expanded)');
  });
});

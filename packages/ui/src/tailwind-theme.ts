/**
 * Tailwind CSS theme extension mapped to GuestPortal CSS variables.
 * Apps that adopt Tailwind should spread this into `theme.extend`.
 * No hardcoded feature colors — all values reference semantic `--gp-*` vars.
 */

import { colorTokens, radii, shellLayout, spacingScale } from './tokens';

function colorVarMap() {
  return Object.fromEntries(
    colorTokens.map((token) => [token, `var(--gp-color-${token})`]),
  ) as Record<(typeof colorTokens)[number], string>;
}

function spacingVarMap() {
  return Object.fromEntries(
    spacingScale.map((step) => [String(step), `var(--gp-space-${step})`]),
  ) as Record<string, string>;
}

export const guestPortalTailwindTheme = {
  colors: {
    gp: colorVarMap(),
  },
  spacing: spacingVarMap(),
  borderRadius: {
    sm: 'var(--gp-radius-sm)',
    md: 'var(--gp-radius-md)',
    lg: 'var(--gp-radius-lg)',
    xl: 'var(--gp-radius-xl)',
    full: 'var(--gp-radius-full)',
  },
  fontFamily: {
    sans: ['var(--gp-font-sans)'],
    display: ['var(--gp-font-display)'],
    mono: ['var(--gp-font-mono)'],
  },
  fontSize: {
    display: ['var(--gp-font-size-display)', { lineHeight: 'var(--gp-line-height-display)' }],
    h1: ['var(--gp-font-size-h1)', { lineHeight: 'var(--gp-line-height-h1)' }],
    h2: ['var(--gp-font-size-h2)', { lineHeight: 'var(--gp-line-height-h2)' }],
    h3: ['var(--gp-font-size-h3)', { lineHeight: 'var(--gp-line-height-h3)' }],
    body: ['var(--gp-font-size-body)', { lineHeight: 'var(--gp-line-height-body)' }],
    'body-small': [
      'var(--gp-font-size-body-small)',
      { lineHeight: 'var(--gp-line-height-body-small)' },
    ],
    label: ['var(--gp-font-size-label)', { lineHeight: 'var(--gp-line-height-label)' }],
    caption: ['var(--gp-font-size-caption)', { lineHeight: 'var(--gp-line-height-caption)' }],
    mono: ['var(--gp-font-size-mono)', { lineHeight: 'var(--gp-line-height-mono)' }],
  },
  boxShadow: {
    none: 'var(--gp-shadow-none)',
    xs: 'var(--gp-shadow-xs)',
    sm: 'var(--gp-shadow-sm)',
    md: 'var(--gp-shadow-md)',
    lg: 'var(--gp-shadow-lg)',
    focus: 'var(--gp-shadow-focus)',
  },
  transitionDuration: {
    instant: 'var(--gp-duration-instant)',
    fast: 'var(--gp-duration-fast)',
    normal: 'var(--gp-duration-normal)',
    slow: 'var(--gp-duration-slow)',
  },
  transitionTimingFunction: {
    standard: 'var(--gp-easing-standard)',
    entrance: 'var(--gp-easing-entrance)',
    exit: 'var(--gp-easing-exit)',
  },
  width: {
    'sidebar-expanded': 'var(--gp-sidebar-expanded)',
    'sidebar-collapsed': 'var(--gp-sidebar-collapsed)',
    'secondary-sidebar': 'var(--gp-secondary-sidebar)',
  },
} as const;

/** Drop-in Tailwind preset shape: `{ theme: { extend: guestPortalTailwindTheme } }`. */
export const guestPortalTailwindPreset = {
  theme: {
    extend: guestPortalTailwindTheme,
  },
} as const;

/** Numeric shell layout constants for non-Tailwind consumers. */
export const shellLayoutPx = shellLayout;

/** Radius numeric mirror for tests / non-CSS consumers. */
export const radiiPx = radii;

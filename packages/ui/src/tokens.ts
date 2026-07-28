/**
 * Shared semantic design tokens for Admin, Staff, and Guest surfaces.
 * Values are mirrored in `tokens.css` as `--gp-*` CSS variables.
 * Do not add page-specific or feature-specific token names here.
 */

export const spacingScale = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const shellLayout = {
  primarySidebarExpanded: 240,
  primarySidebarCollapsed: 68,
  secondarySidebarMin: 240,
  secondarySidebarMax: 280,
} as const;

export const colorTokens = [
  'background',
  'surface',
  'surface-muted',
  'border',
  'text-primary',
  'text-secondary',
  'text-muted',
  'brand',
  'brand-hover',
  'success',
  'warning',
  'danger',
  'info',
  'focus-ring',
] as const;

export type ColorToken = (typeof colorTokens)[number];

/** Light theme baseline (WCAG AA oriented neutrals + brand). */
export const lightColorValues = {
  background: '#f6f7f9',
  surface: '#ffffff',
  'surface-muted': '#eef1f5',
  border: '#d7dde7',
  'text-primary': '#121826',
  'text-secondary': '#3d4659',
  'text-muted': '#5f6678',
  brand: '#0f5c4c',
  'brand-hover': '#0c4a3d',
  success: '#147a45',
  warning: '#9a6700',
  danger: '#b42318',
  info: '#175cd3',
  'focus-ring': '#2e90fa',
} as const satisfies Record<ColorToken, string>;

export const typographyRoles = [
  'display',
  'h1',
  'h2',
  'h3',
  'body',
  'body-small',
  'label',
  'caption',
  'mono',
] as const;

export type TypographyRole = (typeof typographyRoles)[number];

export const typography = {
  fontFamily: {
    sans: "'Source Sans 3', 'Be Vietnam Pro', 'Noto Sans', sans-serif",
    display: "'Source Serif 4', 'Noto Serif', serif",
    mono: "'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace",
  },
  size: {
    display: '2.5rem',
    h1: '2rem',
    h2: '1.5rem',
    h3: '1.25rem',
    body: '1rem',
    'body-small': '0.875rem',
    label: '0.875rem',
    caption: '0.75rem',
    mono: '0.875rem',
  },
  lineHeight: {
    display: '1.2',
    h1: '1.25',
    h2: '1.3',
    h3: '1.35',
    body: '1.5',
    'body-small': '1.45',
    label: '1.4',
    caption: '1.4',
    mono: '1.45',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

/** Elevation shadows — semantic, not component-named. */
export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgb(18 24 38 / 0.06)',
  sm: '0 1px 3px rgb(18 24 38 / 0.08), 0 1px 2px rgb(18 24 38 / 0.04)',
  md: '0 4px 12px rgb(18 24 38 / 0.1), 0 2px 4px rgb(18 24 38 / 0.06)',
  lg: '0 12px 32px rgb(18 24 38 / 0.12), 0 4px 8px rgb(18 24 38 / 0.06)',
  focus: '0 0 0 3px color-mix(in srgb, var(--gp-color-focus-ring) 45%, transparent)',
} as const;

export type ShadowToken = keyof typeof shadows;

/** Motion tokens for intentional UI presence, not decoration noise. */
export const motion = {
  duration: {
    instant: '0ms',
    fast: '120ms',
    normal: '200ms',
    slow: '320ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

/** Sample strings for VI typography coverage in later Storybook / visual tasks. */
export const typographySamples = {
  vi: 'Đăng nhập quản trị — Khách sạn biển Đà Nẵng nhận phòng nhanh',
  en: 'Admin sign-in — Coastal Da Nang hotel express check-in',
} as const;

export const themeExtensionPoints = {
  /**
   * Guest / property brand colors may override only these CSS variables
   * under a scoped selector (e.g. `[data-surface="guest"][data-property-brand]`).
   * Never override text/background contrast tokens in a way that breaks AA.
   */
  guestBrandOverrides: ['--gp-color-brand', '--gp-color-brand-hover'] as const,
  /**
   * Future high-contrast / dark themes should set `data-theme` on `<html>`
   * and redefine the same semantic `--gp-color-*` variables.
   */
  themeAttribute: 'data-theme',
  defaultTheme: 'light',
} as const;

export function cssVarForColor(token: ColorToken): string {
  return `var(--gp-color-${token})`;
}

export function cssVarForSpace(step: (typeof spacingScale)[number]): string {
  return `var(--gp-space-${step})`;
}

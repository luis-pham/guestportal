/**
 * Shared semantic design tokens for Admin, Staff, and Guest surfaces.
 * Values are mirrored in `tokens.css` as `--gp-*` CSS variables.
 * Do not add page-specific or feature-specific token names here.
 */

export const spacingScale = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export const radii = {
  sm: 6,
  md: 9,
  lg: 14,
  xl: 16,
  full: 9999,
} as const;

export const shellLayout = {
  primarySidebarExpanded: 256,
  primarySidebarCollapsed: 64,
  secondarySidebarMin: 240,
  secondarySidebarMax: 280,
} as const;

export const colorTokens = [
  'background',
  'surface',
  'surface-muted',
  'surface-subtle',
  'border',
  'border-subtle',
  'border-strong',
  'text-primary',
  'text-secondary',
  'text-muted',
  'text-faint',
  'brand',
  'brand-hover',
  'brand-subtle',
  'success',
  'warning',
  'danger',
  'info',
  'focus-ring',
] as const;

export type ColorToken = (typeof colorTokens)[number];

/** Light theme baseline (WCAG AA oriented neutrals + brand). */
export const lightColorValues = {
  background: '#f6f4f0',
  surface: '#fdfcfa',
  'surface-muted': '#f1eee9',
  'surface-subtle': '#fbf9f5',
  border: '#e9e4dc',
  'border-subtle': '#ece8e1',
  'border-strong': '#dbd5cb',
  'text-primary': '#26241f',
  'text-secondary': '#6b655c',
  'text-muted': '#9a938a',
  'text-faint': '#b4ada2',
  brand: '#1f5f5b',
  'brand-hover': '#194f4b',
  'brand-subtle': '#edf3f1',
  success: '#3c6b4c',
  warning: '#8a6a2a',
  danger: '#a0483a',
  info: '#46617d',
  'focus-ring': '#1f5f5b',
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
    sans: "'Hanken Grotesk', 'Be Vietnam Pro', 'Noto Sans', system-ui, sans-serif",
    display: "'Newsreader', 'Noto Serif', Georgia, serif",
    mono: "'Spline Sans Mono', 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace",
  },
  size: {
    display: '2.125rem',
    h1: '1.4375rem',
    h2: '1.125rem',
    h3: '0.9375rem',
    body: '0.875rem',
    'body-small': '0.8125rem',
    label: '0.8125rem',
    caption: '0.75rem',
    mono: '0.8125rem',
  },
  lineHeight: {
    display: '1.1',
    h1: '1.22',
    h2: '1.35',
    h3: '1.45',
    body: '1.55',
    'body-small': '1.5',
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
  xs: '0 1px 2px rgb(38 34 28 / 0.06)',
  sm: '0 1px 2px rgb(38 34 28 / 0.08)',
  md: '0 8px 20px rgb(38 34 28 / 0.1), 0 2px 4px rgb(38 34 28 / 0.04)',
  lg: '0 24px 60px rgb(38 34 28 / 0.22)',
  focus: '0 0 0 3px color-mix(in srgb, var(--gp-color-focus-ring) 34%, transparent)',
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
  vi: 'Đăng nhập quản trị - Khách sạn biển Đà Nẵng nhận phòng nhanh',
  en: 'Admin sign-in - Coastal Da Nang hotel express check-in',
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

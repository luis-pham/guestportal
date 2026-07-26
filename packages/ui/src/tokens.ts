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

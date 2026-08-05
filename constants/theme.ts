// PrixBon theme tokens — dark neutral base with warm muted accent.
// Green/red reserved strictly for price/status semantics, not decoration.

export const colors = {
  background: '#0f0f0f',
  surface: '#1c1c1e',
  surfaceAlt: '#2c2c2e',
  border: '#38383a',
  accent: '#d4a373',
  accentSoft: '#2d251e',
  success: '#34d399',
  successSoft: '#0d3323',
  danger: '#f87171',
  warning: '#fbbf24',
  text: '#f5f5f0',
  textMuted: '#9a9aa0',
  textInverse: '#0f0f0f',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

export type ThemeColors = typeof colors;

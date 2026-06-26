// PrixBon theme tokens - dark theme tuned for receipt / shopping / price-alert UI.

export const colors = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  surfaceAlt: '#232342',
  border: '#2a2a44',
  accent: '#667eea',
  accentSoft: '#3f4480',
  success: '#00e676',
  successSoft: '#0d3b22',
  danger: '#ff5252',
  warning: '#ffb74d',
  text: '#f5f5fa',
  textMuted: '#9aa0b4',
  textInverse: '#0f0f1a',
  overlay: 'rgba(0,0,0,0.55)',
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

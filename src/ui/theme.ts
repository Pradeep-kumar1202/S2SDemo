/** Dark palette for the deposit flow. */
export const theme = {
  bg: '#0F1A14',
  surface: '#1B2A21',
  surfaceAlt: '#24362B',
  border: '#2E4436',
  text: '#FFFFFF',
  muted: '#9CB0A4',
  accent: '#21C25E',
  accentText: '#062A13',
  key: '#33473B',
  danger: '#F87171',
  dangerBg: '#3B1D1D',
} as const;

export type Theme = typeof theme;

export const colors = {
  gradientStart: '#FF7A63',
  gradientEnd: '#3D2C6B',
  card: 'rgba(255,255,255,0.94)',
  cardBorder: 'rgba(255,255,255,0.5)',
  textOnGradient: '#FFFFFF',
  textOnGradientMuted: 'rgba(255,255,255,0.8)',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B6B80',
  accent: '#FF7A63',
  accentDark: '#0a7d34',
  danger: '#c0392b',
  navBackground: 'rgba(61,44,107,0.92)',
  navActiveCircle: '#FF7A63',
  navIcon: 'rgba(255,255,255,0.7)',
  navIconActive: '#FFFFFF',
} as const;

export const radius = {
  card: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
} as const;

export const typography = {
  heading: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.textOnGradient,
  },
  subheading: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
} as const;

export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
  elevation: 4,
} as const;

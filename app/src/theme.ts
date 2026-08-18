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
  /** Translucent card, per the mockups — the gradient shows through. */
  cardTranslucent: 'rgba(255,255,255,0.18)',
  cardTranslucentBorder: 'rgba(255,255,255,0.28)',
  ringTrack: 'rgba(26,26,46,0.12)',
  ringTrackOnGlass: 'rgba(255,255,255,0.25)',
  sectionLabel: 'rgba(255,255,255,0.75)',
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

/**
 * The frosted-glass surface from the design mockups: translucent so the
 * coral-to-purple gradient glows through, with a faint light rim and a soft
 * drop shadow to lift it off the background. Content on top uses the
 * `textOnGradient` / `textOnGradientMuted` (white) text tokens.
 *
 * Spread this into a screen's card style, then add its own `padding` /
 * `marginBottom`. Modals and other focused input surfaces deliberately keep
 * the opaque white `colors.card` instead — dark text on frosted glass over a
 * bright gradient is hard to read while typing.
 */
export const glassCard = {
  backgroundColor: colors.cardTranslucent,
  borderWidth: 1,
  borderColor: colors.cardTranslucentBorder,
  borderRadius: radius.card,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 14,
  elevation: 3,
} as const;

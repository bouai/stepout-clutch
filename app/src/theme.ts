/**
 * StepOut design system — one source of truth for the whole app.
 *
 * The look is a dark, calm, glassmorphic "night" surface: a deep desaturated
 * navy that warms into a faint city-glow at the bottom of the screen, with
 * translucent frosted cards floating on top and a single violet→pink accent for
 * anything the user should act on. Every screen, sheet, control and empty state
 * pulls its colours, spacing, radius and type from here so the product reads as
 * one cohesive thing rather than a pile of one-off screens.
 */

export const colors = {
  // ---- Background (the "night" gradient + warm city glow at the bottom) ----
  bgTop: '#0B1020',
  bgMid: '#0C1226',
  bgBottom: '#080B16',
  /** Warm bloom layered over the bottom edge — the blurred-city-lights feel. */
  glowWarm: 'rgba(255,138,110,0.16)',
  glowViolet: 'rgba(124,107,255,0.14)',

  // Legacy names kept so the base gradient still resolves; both point at the
  // dark night now rather than the old coral.
  gradientStart: '#0B1020',
  gradientEnd: '#080B16',

  // ---- Glass surfaces ----
  // These are solid translucent fills (no native backdrop blur): on the dark
  // "night" background a real blur is barely visible, and depending on a native
  // module that may not be in the dev-client binary crashed the app on device.
  // The opacity is tuned so cards still read as distinct frosted surfaces.
  /** Card surface — a dark frosted fill over the night background. */
  glassFill: 'rgba(29,35,58,0.72)',
  /** Near-opaque fill for sheets/modals that must fully cover content behind. */
  glassFillStrong: 'rgba(19,24,42,0.97)',
  /** Hairline rim that catches the light along a card's edge. */
  glassBorder: 'rgba(255,255,255,0.10)',
  glassBorderStrong: 'rgba(255,255,255,0.16)',
  /** A brighter top-edge sheen used on the hero cards. */
  glassHighlight: 'rgba(255,255,255,0.18)',

  // Back-compat aliases used by GlassCard internals.
  glassRim: 'rgba(255,255,255,0.12)',
  glassScrim: 'rgba(12,16,30,0.42)',
  card: 'rgba(22,27,45,0.55)',
  cardBorder: 'rgba(255,255,255,0.10)',
  cardTranslucent: 'rgba(255,255,255,0.06)',
  cardTranslucentBorder: 'rgba(255,255,255,0.12)',

  // ---- Text ----
  textPrimary: '#F4F5FA',
  textSecondary: 'rgba(233,236,247,0.64)',
  textTertiary: 'rgba(233,236,247,0.40)',
  // Text that sits on the dark background/gradient (kept names for back-compat).
  textOnGradient: '#F4F5FA',
  textOnGradientMuted: 'rgba(233,236,247,0.64)',
  sectionLabel: 'rgba(233,236,247,0.52)',

  // ---- Accent (the single violet→pink action colour) ----
  accent: '#7C6BFF',
  accentSoft: 'rgba(124,107,255,0.16)',
  accentBorder: 'rgba(124,107,255,0.55)',
  accentPink: '#E0619B',
  accentDark: '#6A57E6',

  // ---- Semantic ----
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.14)',
  warn: '#FF8A6E',
  warnSoft: 'rgba(255,138,110,0.14)',
  success: '#4ADE80',
  info: '#5AAAFF',

  // ---- Controls ----
  chipIdleBg: 'rgba(255,255,255,0.05)',
  chipIdleBorder: 'rgba(255,255,255,0.12)',
  toggleOff: 'rgba(255,255,255,0.16)',
  toggleKnob: '#FFFFFF',

  // Progress ring tracks.
  ringTrack: 'rgba(255,255,255,0.10)',
  ringTrackOnGlass: 'rgba(255,255,255,0.14)',

  // ---- Bottom navigation ----
  navBackground: 'rgba(16,20,36,0.94)',
  navBorder: 'rgba(255,255,255,0.08)',
  navActiveCircle: '#7C6BFF',
  navIcon: 'rgba(233,236,247,0.5)',
  navIconActive: '#B9AEFF',
} as const;

/** The primary CTA gradient — violet into pink, per the reference. */
export const accentGradient = ['#7C6BFF', '#B368D6', '#E0619B'] as const;

/** The app background gradient (top → bottom). Glow is layered separately. */
export const backgroundGradient = ['#0B1020', '#0C1226', '#080B16'] as const;

export const radius = {
  sm: 12,
  md: 16,
  card: 22,
  lg: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  display: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    color: colors.sectionLabel,
  },
} as const;

/** Soft ambient elevation for floating glass. */
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 24,
  elevation: 8,
} as const;

/** A tighter shadow for the accent CTA so it feels lifted and tactile. */
export const accentShadow = {
  shadowColor: '#7C6BFF',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.4,
  shadowRadius: 18,
  elevation: 8,
} as const;

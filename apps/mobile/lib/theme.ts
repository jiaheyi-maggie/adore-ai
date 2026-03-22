// Adore Design System — Theme Constants
// Source: docs/DESIGN_SYSTEM.md

// ── Colors ────────────────────────────────────────────────────

export const colors = {
  // Light mode
  background: '#FAF8F5',
  surface: '#FFFFFF',
  textPrimary: '#2D2926',
  textSecondary: '#8C8279',
  textMuted: '#B8AFA6',
  border: '#EDE8E3',
  accent: '#C4956A',
  accentHover: '#B3845A',
  accentSoft: '#E8D5C4',
  secondary: '#7B6B5D',
  success: '#6B8F71',
  warning: '#D4A04A',
  error: '#C45B5B',
} as const;

export const categoryColors: Record<string, string> = {
  tops: '#7BA3C9',
  bottoms: '#8B7BB5',
  dresses: '#C97B8B',
  outerwear: '#7B9B8B',
  shoes: '#C4956A',
  accessories: '#B5A08B',
  bags: '#9B8B7B',
  jewelry: '#D4B896',
  activewear: '#7BBBA3',
  swimwear: '#7BADC9',
  sleepwear: '#B5A3C4',
  undergarments: '#B8AFA6',
};

// ── Font Family Names ─────────────────────────────────────────
// These are the keys used in useFonts() and the fontFamily style property.

export const fonts = {
  // Cormorant Garamond — Display / Headers
  cormorant: {
    regular: 'CormorantGaramond_400Regular',
    medium: 'CormorantGaramond_500Medium',
    semibold: 'CormorantGaramond_600SemiBold',
  },
  // Inter — Body / UI
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
  },
  // DM Mono — Numbers / Stats
  mono: {
    regular: 'DMMono_400Regular',
    medium: 'DMMono_500Medium',
  },
} as const;

// ── Type Scale ────────────────────────────────────────────────

export const typography = {
  display: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 32,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  heading: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 24,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  subheading: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 18,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  bodySm: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: colors.textSecondary,
  },
  stat: {
    fontFamily: fonts.mono.medium,
    fontSize: 20,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  statLg: {
    fontFamily: fonts.mono.medium,
    fontSize: 36,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
} as const;

// ── Spacing ───────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

// ── Border Radius ─────────────────────────────────────────────

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

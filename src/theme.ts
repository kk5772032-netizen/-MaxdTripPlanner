import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Design tokens.
 *
 * Screens should reach for these rather than raw numbers — that's what keeps
 * the app looking like one app rather than fourteen screens.
 */

export const colors = {
  /** App background, behind cards. */
  bg: '#F6F7F9',
  /** Card and header background. */
  surface: '#FFFFFF',
  /** A recessed surface for grouped rows and inputs. */
  surfaceSunken: '#F2F4F7',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',

  text: '#0C111D',
  textMuted: '#5D6B82',
  textFaint: '#98A2B3',
  /** Text on a coloured fill. */
  textOnPrimary: '#FFFFFF',

  primary: '#2563EB',
  primaryPressed: '#1D4FD7',
  primarySoft: '#EFF4FF',

  under: '#12B76A',
  near: '#F79009',
  over: '#F04438',
  unset: '#98A2B3',

  underSoft: '#ECFDF3',
  nearSoft: '#FFFAEB',
  overSoft: '#FEF3F2',

  overlay: 'rgba(12, 17, 29, 0.45)',
} as const;

export const statusColor: Record<string, string> = {
  under: colors.under,
  near: colors.near,
  over: colors.over,
  unset: colors.unset,
};

export const statusSoftColor: Record<string, string> = {
  under: colors.underSoft,
  near: colors.nearSoft,
  over: colors.overSoft,
  unset: colors.surfaceSunken,
};

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
  xl: 20,
  pill: 999,
} as const;

/**
 * Type scale.
 *
 * Sizes step deliberately (30/22/17/15/13/12) rather than drifting by ones, and
 * every entry carries its own lineHeight — RN's default leading is too tight
 * for body copy and too loose for numerals.
 */
export const type = {
  display: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  captionStrong: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  /** Tabular-ish figures for money. */
  amount: { fontSize: 15, fontWeight: '700', lineHeight: 20, letterSpacing: -0.2 },
} as const satisfies Record<string, TextStyle>;

/**
 * Elevation.
 *
 * iOS reads shadow*, Android reads elevation, so both are set. Kept very soft —
 * heavy drop shadows are the fastest way to make an app look dated.
 */
export const elevation = {
  none: {},
  sm: {
    shadowColor: '#0C111D',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  md: {
    shadowColor: '#0C111D',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#0C111D',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const satisfies Record<string, ViewStyle>;

/** Minimum comfortable tap target. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TAP = 44;

/**
 * Category colours — identity, used by the dashboard pie and the expense log.
 *
 * The four real categories are a validated categorical palette: every pair
 * clears the colourblind-separation and normal-vision floors, each hue is above
 * the chroma floor, and all four hit 3:1 against the card surface. Don't
 * re-pick these by eye.
 *
 * `other` is deliberately the odd one out: a residual bucket should read as
 * neutral rather than claim a fifth identity, and every chart that uses these
 * carries a legend and direct labels, so nothing here is colour-alone.
 *
 * These are kept clear of the budget status hues above — on the dashboard a red
 * mark means "over budget", and no expense category may borrow that meaning.
 */
export const categoryColors: Record<string, string> = {
  food: '#DC6803',
  activity: '#2E90FA',
  transport: '#9E33D6',
  lodging: '#039855',
  other: '#8D97A5',
};

export const categoryLabels: Record<string, string> = {
  food: 'Food',
  activity: 'Activity',
  transport: 'Transport',
  lodging: 'Lodging',
  other: 'Other',
};

/** Ionicons name per category, so a category reads without relying on colour. */
export const categoryIcons: Record<string, string> = {
  food: 'restaurant',
  activity: 'walk',
  transport: 'car',
  lodging: 'bed',
  other: 'ellipsis-horizontal',
};

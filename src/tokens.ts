import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Non-colour design tokens.
 *
 * Split from the palettes because these do not change with the theme — a 16pt
 * gutter is 16pt in the dark.
 */

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
 * Sizes step deliberately (34/30/22/17/15/13/12) rather than drifting by ones,
 * and every entry carries its own lineHeight — RN's default leading is too
 * tight for body copy and too loose for numerals.
 */
export const type = {
  hero: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8, lineHeight: 40 },
  display: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  captionStrong: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  /** Tabular figures for money, so columns of digits line up. */
  amount: {
    fontSize: 15, fontWeight: '700', lineHeight: 20,
    letterSpacing: -0.2, fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

/**
 * Elevation.
 *
 * iOS reads shadow*, Android reads elevation, so both are set. Kept very soft —
 * heavy drop shadows are the fastest way to make an app look dated. In the dark
 * palette a shadow is invisible, so depth there comes from surface lightness.
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

/**
 * Booking kinds. Each is the recognisable silhouette for its mode of travel —
 * a reservation list is scanned, not read, so the icon does the sorting before
 * the title is even parsed.
 */
export const bookingIcons: Record<string, string> = {
  flight: 'airplane',
  lodging: 'bed',
  train: 'train',
  bus: 'bus',
  car: 'car-sport',
  restaurant: 'restaurant',
  other: 'bookmark',
};

export const bookingLabels: Record<string, string> = {
  flight: 'Flight',
  lodging: 'Stay',
  train: 'Train',
  bus: 'Bus',
  car: 'Car',
  restaurant: 'Table',
  other: 'Other',
};


/**
 * What a booking counts as when it becomes an expense.
 *
 * Every way of getting somewhere is transport, whatever the vehicle: a bus
 * ticket and a hire car answer the same question in a spending breakdown.
 */
export const bookingExpenseCategory = {
  flight: 'transport',
  train: 'transport',
  bus: 'transport',
  car: 'transport',
  lodging: 'lodging',
  restaurant: 'food',
  other: 'other',
} as const;

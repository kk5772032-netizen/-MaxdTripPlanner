/** Shared design tokens. Kept small and flat on purpose. */

export const colors = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#E4E7EC',
  text: '#101828',
  textMuted: '#667085',
  textFaint: '#98A2B3',
  primary: '#2563EB',
  primarySoft: '#EFF4FF',
  under: '#12B76A',
  near: '#F79009',
  over: '#F04438',
  unset: '#98A2B3',
  overlay: 'rgba(16, 24, 40, 0.45)',
} as const;

export const statusColor: Record<string, string> = {
  under: colors.under,
  near: colors.near,
  over: colors.over,
  unset: colors.unset,
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
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/**
 * Category colors — identity, used by the dashboard pie and the expense log.
 *
 * The four real categories are a validated categorical palette: every pair
 * clears the colorblind-separation and normal-vision floors, each hue is above
 * the chroma floor, and all four hit 3:1 against the card surface. Don't
 * re-pick these by eye.
 *
 * `other` is deliberately the odd one out: a residual bucket should read as
 * neutral rather than claim a fifth identity, and every chart that uses these
 * carries a legend and direct labels, so nothing here is color-alone.
 *
 * These are kept clear of the budget status hues below — on the dashboard a red
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

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

/** Category colors used by the dashboard pie chart and expense rows. */
export const categoryColors: Record<string, string> = {
  food: '#F79009',
  activity: '#2563EB',
  transport: '#7A5AF8',
  lodging: '#12B76A',
  other: '#98A2B3',
};

export const categoryLabels: Record<string, string> = {
  food: 'Food',
  activity: 'Activity',
  transport: 'Transport',
  lodging: 'Lodging',
  other: 'Other',
};

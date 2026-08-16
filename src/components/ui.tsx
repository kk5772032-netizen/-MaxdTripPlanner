import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import {
  HIT_SLOP,
  MIN_TAP,
  colors,
  elevation,
  radius,
  spacing,
  type,
} from '../theme';

/** Shared primitives, so screens are about behaviour rather than padding. */

export type IconName = keyof typeof Ionicons.glyphMap;

/** Haptics are a no-op on web and must never break an action if unavailable. */
function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(style).catch(() => {});
}

export function notifySuccess() {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function Card({
  children,
  style,
  raised = true,
}: {
  children: ReactNode;
  style?: ViewStyle;
  raised?: boolean;
}) {
  return (
    <View style={[styles.card, raised && elevation.sm, style]}>{children}</View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const tint =
    variant === 'primary' || variant === 'danger' ? colors.textOnPrimary : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      // Without an explicit label the accessible name is assembled from the
      // child text nodes, which includes the icon font's own glyph character.
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled }}
      onPress={() => {
        if (isDisabled) return;
        tap();
        onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        variant === 'primary' && pressed && !isDisabled && styles.buttonPrimaryPressed,
        variant !== 'primary' && pressed && !isDisabled && styles.pressedSoft,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={17} color={tint} /> : null}
          <Text style={[styles.buttonText, { color: tint }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

/** Section heading with an optional trailing action. */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; icon?: IconName; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={HIT_SLOP}
          onPress={() => {
            tap();
            action.onPress();
          }}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressedSoft]}
        >
          {action.icon ? (
            <Ionicons name={action.icon} size={15} color={colors.primary} />
          ) : null}
          <Text style={styles.sectionActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'compass-outline',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </View>
  );
}

/**
 * Placeholder blocks shaped like the content that's coming.
 *
 * Used instead of a bare spinner on list screens: a spinner tells you to wait,
 * a skeleton tells you what you're waiting for and stops the layout jumping
 * when the data lands.
 */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.card, elevation.sm, styles.skeletonCard]}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { width: '55%' }]} />
            <View style={[styles.skeletonLine, { width: '35%', height: 10 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Horizontal pill picker, for view modes and tabs. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) tap(Haptics.ImpactFeedbackStyle.Soft);
              onChange(option.value);
            }}
            style={[styles.segment, active && styles.segmentActive, active && elevation.sm]}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={15}
                color={active ? colors.text : colors.textMuted}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Selectable pill, for currencies, categories and filters. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Tints the chip when selected — used for expense categories. */
  color?: string;
  style?: ViewStyle;
}) {
  const tint = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        tap(Haptics.ImpactFeedbackStyle.Soft);
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: `${tint}14`, borderColor: tint },
        pressed && styles.pressedSoft,
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? tint : colors.textMuted} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.chipText, selected && { color: tint }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Header text button, inset from the screen edge with a real tap target. */
export function HeaderAction({
  label,
  icon,
  onPress,
  tone = 'primary',
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: 'primary' | 'danger';
}) {
  const tint = tone === 'danger' ? colors.over : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressedSoft]}
    >
      {icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
      <Text style={[styles.headerActionText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function Fab({
  onPress,
  label,
  icon = 'add',
  /** Lifts the button clear of a sticky footer. */
  offsetBottom = spacing.xl,
}: {
  onPress: () => void;
  label: string;
  icon?: IconName;
  offsetBottom?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.fab,
        elevation.lg,
        { bottom: offsetBottom },
        pressed && styles.fabPressed,
      ]}
    >
      <Ionicons name={icon} size={26} color={colors.textOnPrimary} />
    </Pressable>
  );
}

/** Circular icon button, for row-level destructive and secondary actions. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'muted',
  size = 34,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'muted' | 'primary' | 'danger';
  size?: number;
}) {
  const tint =
    tone === 'danger' ? colors.over : tone === 'primary' ? colors.primary : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressedSoft,
      ]}
    >
      <Ionicons name={icon} size={size * 0.52} color={tint} />
    </Pressable>
  );
}

/** Inline notice for warnings, offline states and missing configuration. */
export function Notice({
  tone = 'info',
  icon,
  title,
  body,
}: {
  tone?: 'info' | 'warning' | 'danger';
  icon?: IconName;
  title?: string;
  body: string;
}) {
  const tint =
    tone === 'danger' ? colors.over : tone === 'warning' ? colors.near : colors.primary;
  const bg =
    tone === 'danger' ? colors.overSoft : tone === 'warning' ? colors.nearSoft : colors.primarySoft;
  const defaultIcon: IconName =
    tone === 'danger' ? 'alert-circle' : tone === 'warning' ? 'warning' : 'information-circle';

  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Ionicons name={icon ?? defaultIcon} size={18} color={tint} style={styles.noticeIcon} />
      <View style={styles.noticeBody}>
        {title ? <Text style={[styles.noticeTitle, { color: tint }]}>{title}</Text> : null}
        <Text style={styles.noticeText}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  pressedSoft: { opacity: 0.6 },

  button: {
    minHeight: MIN_TAP + 4,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryPressed: { backgroundColor: colors.primaryPressed },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: colors.over },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { ...type.bodyStrong },

  field: { marginBottom: spacing.lg },
  fieldLabel: { ...type.label, color: colors.textMuted, marginBottom: spacing.sm },
  fieldHint: { ...type.caption, color: colors.textFaint, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: MIN_TAP,
    ...type.body,
    color: colors.text,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: { ...type.heading, color: colors.text, flex: 1 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionActionText: { ...type.label, color: colors.primary },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...type.heading, color: colors.text, marginBottom: spacing.xs },
  emptyBody: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  emptyAction: { marginTop: spacing.xl, alignSelf: 'stretch' },

  loading: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md },
  loadingLabel: { ...type.caption, color: colors.textMuted },

  skeletonWrap: { padding: spacing.lg, gap: spacing.md },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSunken,
  },
  skeletonLines: { flex: 1, gap: spacing.sm },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceSunken },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 38,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { ...type.label, color: colors.textMuted },
  segmentTextActive: { color: colors.text },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 190,
  },
  chipText: { ...type.label, color: colors.textMuted },

  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // native-stack renders headerRight flush with the screen edge, so the inset
    // has to live on the element itself.
    paddingRight: spacing.lg,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerActionText: { ...type.bodyStrong },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.96 }] },

  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },

  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeIcon: { marginTop: 1 },
  noticeBody: { flex: 1, gap: 2 },
  noticeTitle: { ...type.label },
  noticeText: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
});

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SHIMMER_MS, animateTo, duration, easing, useAnimatedNumber, useReducedMotion } from '../motion';
import { HIT_SLOP, MIN_TAP, elevation, makeStyles, radius, spacing, type, useTheme } from '../theme';

/** Shared primitives, so screens are about behaviour rather than padding. */

/** Inset of the selected pill from the track's edge. */
const SEGMENT_PADDING = 4;

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
  const styles = useStyles();
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
  const styles = useStyles();
  const t = useTheme();
  const isDisabled = disabled || loading;
  const tint =
    variant === 'primary' || variant === 'danger' ? t.textOnPrimary : t.primary;

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
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.textFaint}
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
  const styles = useStyles();
  const t = useTheme();
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
            <Ionicons name={action.icon} size={15} color={t.primary} />
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
  const styles = useStyles();
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={t.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={t.primary} />
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
  const styles = useStyles();
  const reduced = useReducedMotion();

  // A slow, low-contrast pulse: enough to read as "still working", not enough
  // to draw the eye away from whatever lands next. Under reduce motion the
  // placeholders simply sit still — they already say "loading" by shape.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: SHIMMER_MS / 2,
          easing: easing.standard,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: SHIMMER_MS / 2,
          easing: easing.standard,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);

  const opacity = reduced
    ? 1
    : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });

  return (
    <View style={styles.skeletonWrap} accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.card, elevation.sm, styles.skeletonCard]}>
          <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
          <View style={styles.skeletonLines}>
            <Animated.View style={[styles.skeletonLine, { width: '55%', opacity }]} />
            <Animated.View
              style={[styles.skeletonLine, { width: '35%', height: 10, opacity }]}
            />
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
  const styles = useStyles();
  const t = useTheme();
  const reduced = useReducedMotion();

  // The selected pill travels to the tapped segment rather than blinking out
  // and in somewhere else — the movement is what says "this became that".
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const slide = useAnimatedNumber(index, { ms: duration.standard, reduced });
  const [width, setWidth] = useState(0);
  const segmentWidth = options.length > 0 ? width / options.length : 0;

  return (
    <View
      style={[styles.segmented, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - SEGMENT_PADDING * 2)}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          // Decorative: the selected state is already on each tab.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[
            styles.segmentThumb,
            elevation.sm,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, segmentWidth],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

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
            style={styles.segment}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={15}
                color={active ? t.text : t.textMuted}
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
  /**
   * Overrides the spoken label. Two rows of currency chips both say "USD", and
   * a screen reader swiping through them hears the same word twice with no way
   * to tell which question it is answering.
   */
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Tints the chip when selected — used for expense categories. */
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const t = useTheme();
  const tint = color ?? t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      // The pill is 36pt tall for density; hitSlop takes the touch target to
      // the 44pt minimum without changing the layout.
      hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
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
        <Ionicons name={icon} size={14} color={selected ? tint : t.textMuted} />
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
  /**
   * Two worded actions plus a trip name is more than a phone header holds, and
   * the title is the thing that loses. An icon-only action keeps its label for
   * screen readers and gives the name back its room.
   */
  showLabel = true,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: 'primary' | 'danger';
  showLabel?: boolean;
}) {
  const styles = useStyles();
  const t = useTheme();
  const tint = tone === 'danger' ? t.over : t.primary;
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
      {icon ? <Ionicons name={icon} size={showLabel ? 18 : 21} color={tint} /> : null}
      {showLabel ? (
        <Text style={[styles.headerActionText, { color: tint }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * A panel that rises from the bottom for a short, closed set of choices.
 *
 * This app answers most questions inline and undoes destructive things with a
 * toast rather than asking first, so a modal has to earn itself. This one does:
 * "share as what?" has two answers, neither is destructive, and putting both as
 * permanent buttons on the plan would give a rarely-used action more of the
 * screen than the plan it is exporting.
 *
 * Dismissal is deliberately generous — the backdrop, the handle, the system
 * back button — because the worst version of a sheet is one you have to hunt
 * for the way out of.
 */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animateTo(progress, visible ? 1 : 0, {
      ms: visible ? duration.standard : duration.micro,
      reduced,
      curve: visible ? easing.enter : easing.exit,
    });
  }, [visible, reduced, progress]);

  return (
    <Modal
      visible={visible}
      transparent
      // The slide is ours, so the OS must not add a second one on top of it.
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.sheetBackdrop, { opacity: progress }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title.toLowerCase()}`}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>

      <View style={styles.sheetAnchor} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: spacing.lg + insets.bottom },
            {
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [340, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${title.toLowerCase()}`}
            hitSlop={HIT_SLOP}
            onPress={onClose}
            style={styles.sheetHandleTap}
          >
            <View style={styles.sheetHandle} />
          </Pressable>

          <Text style={styles.sheetTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}

          <View style={styles.sheetBody}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** A full-width choice inside a `Sheet`: what it does, and what that means. */
export function SheetOption({
  icon,
  title,
  body,
  onPress,
  disabled,
}: {
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.sheetOption,
        pressed && styles.pressedSoft,
        disabled && styles.sheetOptionOff,
      ]}
    >
      <View style={styles.sheetOptionIcon}>
        <Ionicons name={icon} size={20} color={t.primary} />
      </View>
      <View style={styles.sheetOptionText}>
        <Text style={styles.sheetOptionTitle}>{title}</Text>
        <Text style={styles.sheetOptionBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
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
  const styles = useStyles();
  const t = useTheme();
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
      <Ionicons name={icon} size={26} color={t.textOnPrimary} />
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
  const styles = useStyles();
  const t = useTheme();
  const tint =
    tone === 'danger' ? t.over : tone === 'primary' ? t.primary : t.textMuted;
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
  const styles = useStyles();
  const t = useTheme();
  const tint =
    tone === 'danger' ? t.over : tone === 'warning' ? t.near : t.primary;
  const bg =
    tone === 'danger' ? t.overSoft : tone === 'warning' ? t.nearSoft : t.primarySoft;
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

const useStyles = makeStyles((t) => ({
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.overlay,
  },
  sheetAnchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    ...elevation.lg,
  },
  sheetHandleTap: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: t.borderStrong },
  sheetTitle: { ...type.title, color: t.text, marginTop: spacing.xs },
  sheetSubtitle: { ...type.caption, color: t.textMuted },
  sheetBody: { marginTop: spacing.md, gap: spacing.sm },

  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    backgroundColor: t.surfaceSunken,
  },
  sheetOptionOff: { opacity: 0.5 },
  sheetOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.primarySoft,
  },
  sheetOptionText: { flex: 1, gap: 1 },
  sheetOptionTitle: { ...type.bodyStrong, color: t.text },
  sheetOptionBody: { ...type.caption, color: t.textMuted },

  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
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
  buttonPrimary: { backgroundColor: t.accent },
  buttonPrimaryPressed: { backgroundColor: t.accentPressed },
  buttonSecondary: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: t.dangerFill },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { ...type.bodyStrong },

  field: { marginBottom: spacing.lg },
  fieldLabel: { ...type.label, color: t.textMuted, marginBottom: spacing.sm },
  fieldHint: { ...type.caption, color: t.textFaint, marginTop: spacing.xs },
  input: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: MIN_TAP,
    ...type.body,
    color: t.text,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: { ...type.heading, color: t.text, flex: 1 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionActionText: { ...type.label, color: t.primary },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...type.heading, color: t.text, marginBottom: spacing.xs },
  emptyBody: { ...type.body, color: t.textMuted, textAlign: 'center' },
  emptyAction: { marginTop: spacing.xl, alignSelf: 'stretch' },

  loading: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md },
  loadingLabel: { ...type.caption, color: t.textMuted },

  skeletonWrap: { padding: spacing.lg, gap: spacing.md },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.surfaceSunken,
  },
  skeletonLines: { flex: 1, gap: spacing.sm },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: t.surfaceSunken },

  segmented: {
    flexDirection: 'row',
    backgroundColor: t.surfaceSunken,
    borderRadius: radius.md,
    padding: SEGMENT_PADDING,
    // No gap: the sliding thumb is positioned as a fraction of the track, so
    // the segments have to tile it exactly.
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: MIN_TAP,
    borderRadius: radius.sm,
  },
  segmentThumb: {
    position: 'absolute',
    top: SEGMENT_PADDING,
    left: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    borderRadius: radius.sm,
    backgroundColor: t.surfaceRaised,
  },
  segmentText: { ...type.label, color: t.textMuted },
  segmentTextActive: { color: t.text },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    maxWidth: 190,
  },
  chipText: { ...type.label, color: t.textMuted },

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
    backgroundColor: t.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: { backgroundColor: t.accentPressed, transform: [{ scale: 0.96 }] },

  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surfaceSunken,
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
  noticeText: { ...type.caption, color: t.textMuted, lineHeight: 18 },
}));

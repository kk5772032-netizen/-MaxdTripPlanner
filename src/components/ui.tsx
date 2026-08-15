import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '../theme';

/** Small shared primitives so screens stay about behaviour, not padding. */

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'secondary' && styles.buttonTextSecondary,
          ]}
        >
          {title}
        </Text>
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

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

/** Horizontal pill picker. Used for currency, category and view-mode choices. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
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
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Fab({
  onPress,
  label,
  /** Lifts the button clear of a sticky footer. */
  offsetBottom = spacing.xl,
}: {
  onPress: () => void;
  label: string;
  offsetBottom?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { bottom: offsetBottom },
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
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
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  buttonDanger: { backgroundColor: colors.over },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonTextSecondary: { color: colors.primary },
  field: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  fieldHint: { fontSize: 12, color: colors.textFaint, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyAction: { marginTop: spacing.lg, alignSelf: 'stretch' },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: colors.text },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
});

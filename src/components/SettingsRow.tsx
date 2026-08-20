import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors, elevation, radius, spacing, type } from '../theme';
import type { IconName } from './ui';

/** Grouped-list row: value + chevron, a switch, or a destructive action. */
export function SettingsRow({
  icon,
  label,
  sub,
  value,
  action,
  onPress,
  onToggle,
  toggled,
  danger,
  disabled,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  value?: string;
  action?: { label: string; onPress: () => void };
  onPress?: () => void;
  onToggle?: (next: boolean) => void;
  toggled?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const tint = danger ? colors.over : colors.textMuted;
  const isSwitch = onToggle !== undefined;

  const body = (
    <View style={[styles.row, disabled && styles.disabled]}>
      <Ionicons name={icon} size={20} color={tint} />
      <View style={styles.text}>
        <Text style={[styles.label, danger && styles.danger]}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>

      {value ? <Text style={styles.value}>{value}</Text> : null}

      {action ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={action.onPress}>
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : null}

      {isSwitch ? (
        <Switch
          value={!!toggled}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor="#fff"
        />
      ) : null}

      {onPress && !isSwitch && !action ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      ) : null}
    </View>
  );

  if (!onPress || isSwitch) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.group, elevation.sm]}>
        {rows.map((row, i) => (
          <View key={i} style={i ? styles.divided : undefined}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  disabled: { opacity: 0.45 },
  pressed: { backgroundColor: colors.bg },
  text: { flex: 1, gap: 1 },
  label: { ...type.body, color: colors.text },
  danger: { color: colors.over },
  sub: { ...type.caption, color: colors.textMuted },
  value: { ...type.body, color: colors.textMuted },
  action: { ...type.label, color: colors.primary },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.label, color: colors.textMuted, paddingLeft: spacing.xs },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

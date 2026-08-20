import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../budget/money';
import { formatDate } from '../dates';
import { categoryIcons, categoryLabels, makeStyles, radius, spacing, type, useTheme } from '../theme';
import type { Expense } from '../types';

/** One line in the expense log. */
export function ExpenseRow({
  expense,
  currency,
  stopName,
  onPress,
  onLongPress,
}: {
  expense: Expense;
  currency: string;
  /** Null for trip-level expenses (flights, visas). */
  stopName: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const meta = [
    stopName ?? 'Whole trip',
    formatDate(expense.spentAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${categoryLabels[expense.category]} ${formatMoney(expense.amountMinor, currency)}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View
        style={[styles.icon, { backgroundColor: `${t.categories[expense.category]}18` }]}
      >
        <Ionicons
          name={categoryIcons[expense.category] as never}
          size={16}
          color={t.categories[expense.category]}
        />
      </View>

      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.note?.trim() || categoryLabels[expense.category]}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <Text style={styles.amount}>{formatMoney(expense.amountMinor, currency)}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
    backgroundColor: t.surface,
  },
  pressed: { backgroundColor: t.bg },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 1 },
  title: { ...type.bodyStrong, color: t.text },
  meta: { ...type.caption, color: t.textMuted },
  amount: { ...type.amount, color: t.text },
}));

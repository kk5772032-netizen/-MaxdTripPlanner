import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../budget/money';
import { formatDate } from '../dates';
import { categoryColors, categoryLabels, colors, radius, spacing } from '../theme';
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
        style={[styles.dot, { backgroundColor: categoryColors[expense.category] }]}
      />

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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.bg },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  main: { flex: 1, gap: 1 },
  title: { fontSize: 15, color: colors.text, fontWeight: '500' },
  meta: { fontSize: 12, color: colors.textMuted },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
});

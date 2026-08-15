import { StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import { currencySymbol } from '../budget/money';
import { colors, radius, spacing } from '../theme';

/** Currency-prefixed numeric field. The caller owns parsing to minor units. */
export function AmountInput({
  value,
  onChangeText,
  currency,
  placeholder = '0',
  style,
  autoFocus,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  currency: string;
  placeholder?: string;
  style?: ViewStyle;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.symbol}>{currencySymbol(currency)}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  symbol: { fontSize: 15, color: colors.textMuted, marginRight: spacing.xs },
  input: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
});

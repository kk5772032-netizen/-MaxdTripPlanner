import { StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import { currencySymbol } from '../budget/money';
import { makeStyles, radius, spacing, useTheme } from '../theme';

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
  const styles = useStyles();
  const t = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.symbol}>{currencySymbol(currency)}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textFaint}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        style={styles.input}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  symbol: { fontSize: 15, color: t.textMuted, marginRight: spacing.xs },
  input: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: t.text },
}));

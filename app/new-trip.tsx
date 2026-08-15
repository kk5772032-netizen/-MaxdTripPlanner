import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SUPPORTED_CURRENCIES,
  currencySymbol,
  parseMoney,
  toDecimalString,
} from '../src/budget/money';
import { DateRangeField } from '../src/components/DateRangeField';
import { Button, Field, Input } from '../src/components/ui';
import * as tripsRepo from '../src/db/repositories/trips';
import { useTripsStore } from '../src/state/tripsStore';
import { colors, radius, spacing } from '../src/theme';

/**
 * Create *and* edit — passing `?tripId=` switches it to edit mode. Same fields
 * either way, so a second screen would only be duplication.
 */
export default function NewTripScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const isEdit = !!tripId;

  const create = useTripsStore((s) => s.create);
  const update = useTripsStore((s) => s.update);
  const remove = useTripsStore((s) => s.remove);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [budgetText, setBudgetText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!tripId) return;
    void tripsRepo.getTrip(tripId).then((trip) => {
      if (!trip) return;
      setName(trip.name);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
      setCurrency(trip.currency);
      setBudgetText(toDecimalString(trip.totalBudgetMinor, trip.currency));
      setLoaded(true);
    });
  }, [tripId]);

  const canSave = name.trim().length > 0 && !saving && loaded;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const input = {
      name: name.trim(),
      startDate,
      endDate,
      currency,
      totalBudgetMinor: parseMoney(budgetText, currency),
    };
    try {
      if (tripId) {
        await update(tripId, input);
        router.back();
      } else {
        const trip = await create(input);
        // Replace so Back from the trip lands on the list, not this form.
        router.replace(`/trip/${trip.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Trip name">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Delhi long weekend"
            autoFocus={!isEdit}
            returnKeyType="next"
          />
        </Field>

        <Field label="Dates">
          <DateRangeField
            start={startDate}
            end={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        </Field>

        <Field label="Currency">
          <View style={styles.currencyRow}>
            {SUPPORTED_CURRENCIES.map((code) => {
              const active = code === currency;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setCurrency(code)}
                  style={[styles.currencyChip, active && styles.currencyChipActive]}
                >
                  <Text style={[styles.currencyText, active && styles.currencyTextActive]}>
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field
          label="Total budget"
          hint="Optional. Leave empty to track spending without an overall cap."
        >
          <View style={styles.amountRow}>
            <Text style={styles.amountSymbol}>{currencySymbol(currency)}</Text>
            <Input
              value={budgetText}
              onChangeText={setBudgetText}
              placeholder="0"
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
        </Field>

        <Button
          title={isEdit ? 'Save changes' : 'Create trip'}
          onPress={save}
          disabled={!canSave}
          loading={saving}
        />

        {isEdit ? (
          <Button
            title="Delete trip"
            variant="danger"
            style={styles.delete}
            onPress={() =>
              Alert.alert(
                'Delete trip?',
                `"${name}" and everything in it — stops, activities, food plans and expenses — will be removed.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await remove(tripId!);
                      router.replace('/trips');
                    },
                  },
                ],
              )
            }
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  currencyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  currencyChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  currencyText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  currencyTextActive: { color: colors.primary },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amountSymbol: { fontSize: 17, color: colors.textMuted, minWidth: 20 },
  amountInput: { flex: 1 },
  delete: { marginTop: spacing.md },
});

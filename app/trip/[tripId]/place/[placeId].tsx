import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { stopSummary } from '../../../../src/budget/engine';
import { formatMoney, parseMoney, toDecimalString } from '../../../../src/budget/money';
import { ActivitiesTab } from '../../../../src/components/stop/ActivitiesTab';
import { FoodTab } from '../../../../src/components/stop/FoodTab';
import { StopNotes } from '../../../../src/components/stop/StopNotes';
import { BudgetBar } from '../../../../src/components/BudgetBar';
import { AmountInput } from '../../../../src/components/AmountInput';
import { Button, Card, Field, Loading, SegmentedControl } from '../../../../src/components/ui';
import { useTripStore } from '../../../../src/state/tripStore';
import { colors, spacing } from '../../../../src/theme';

type Tab = 'activities' | 'food' | 'budget';

export default function StopDetailScreen() {
  const router = useRouter();
  const { tripId, placeId } = useLocalSearchParams<{ tripId: string; placeId: string }>();
  const [tab, setTab] = useState<Tab>('activities');

  const { trip, loading, open, removeStop } = useTripStore();

  useFocusEffect(
    useCallback(() => {
      void open(tripId);
    }, [tripId, open]),
  );

  // Subscribe to the whole arrays and narrow with useMemo. A selector that
  // filters inside the subscription returns a new array on every call, which
  // makes useSyncExternalStore see a changed snapshot every render and spin
  // forever — `.find` below is safe because it returns an existing element.
  const stop = useTripStore((s) => s.stops.find((x) => x.id === placeId));
  const allActivities = useTripStore((s) => s.activities);
  const allFoodPlans = useTripStore((s) => s.foodPlans);
  const allExpenses = useTripStore((s) => s.expenses);

  const activities = useMemo(
    () => allActivities.filter((a) => a.stopId === placeId),
    [allActivities, placeId],
  );
  const foodPlans = useMemo(
    () => allFoodPlans.filter((f) => f.stopId === placeId),
    [allFoodPlans, placeId],
  );
  const expenses = useMemo(
    () => allExpenses.filter((e) => e.stopId === placeId),
    [allExpenses, placeId],
  );

  const summary = useMemo(
    () => (stop ? stopSummary(stop, activities, foodPlans, expenses) : null),
    [stop, activities, foodPlans, expenses],
  );

  const confirmRemove = () => {
    if (!stop) return;
    Alert.alert(
      'Remove stop?',
      `"${stop.name}", its activities and its food plan will be removed. Expenses logged against it are kept as trip-level expenses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeStop(stop.id);
            router.back();
          },
        },
      ],
    );
  };

  if (loading && !stop) return <Loading />;

  if (!stop || !trip || !summary) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This stop is no longer part of the trip.</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: stop.name }} />

      <View style={styles.tabBar}>
        <StopNotes stop={stop} />

        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'activities', label: `Activities${activities.length ? ` (${activities.length})` : ''}` },
            { value: 'food', label: `Food${foodPlans.length ? ` (${foodPlans.length})` : ''}` },
            { value: 'budget', label: 'Budget' },
          ]}
        />
      </View>

      {tab === 'activities' ? (
        <ActivitiesTab stop={stop} currency={trip.currency} activities={activities} />
      ) : null}

      {tab === 'food' ? (
        <FoodTab stop={stop} currency={trip.currency} foodPlans={foodPlans} />
      ) : null}

      {tab === 'budget' ? (
        <BudgetTab
          currency={trip.currency}
          summary={summary}
          onRemoveStop={confirmRemove}
          expenseCount={expenses.length}
          onOpenExpenses={() => router.push(`/trip/${tripId}/expenses?stopId=${stop.id}`)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function BudgetTab({
  currency,
  summary,
  onRemoveStop,
  expenseCount,
  onOpenExpenses,
}: {
  currency: string;
  summary: ReturnType<typeof stopSummary>;
  onRemoveStop: () => void;
  expenseCount: number;
  onOpenExpenses: () => void;
}) {
  const updateStop = useTripStore((s) => s.updateStop);
  const [capText, setCapText] = useState(
    toDecimalString(summary.stop.plannedBudgetMinor, currency),
  );
  const [saving, setSaving] = useState(false);

  const saveCap = async () => {
    setSaving(true);
    try {
      await updateStop(summary.stop.id, {
        plannedBudgetMinor: parseMoney(capText, currency),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Field
          label="Budget for this stop"
          hint="The cap you don't want to exceed here. Leave empty for no cap."
        >
          <AmountInput
            value={capText}
            onChangeText={setCapText}
            currency={currency}
            accessibilityLabel="Stop budget"
          />
        </Field>
        <Button title="Save budget" onPress={saveCap} loading={saving} />
      </Card>

      <Card style={styles.gapped}>
        <BudgetBar
          label="Spent against budget"
          actual={summary.actual}
          cap={summary.budget}
          planned={summary.planned}
          currency={currency}
        />

        <View style={styles.rows}>
          <Row label="Planned" value={formatMoney(summary.planned, currency)} />
          <Row label="Actual" value={formatMoney(summary.actual, currency)} />
          <Row
            label="Remaining"
            value={summary.remaining === null ? '—' : formatMoney(summary.remaining, currency)}
            emphasis={summary.remaining !== null && summary.remaining < 0 ? 'over' : undefined}
          />
        </View>

        <Text style={styles.plannedNote}>
          Planned is what your activities and food plan add up to. The tick on the bar marks it
          against your cap.
        </Text>
      </Card>

      <Button
        title={
          expenseCount
            ? `View ${expenseCount} expense${expenseCount === 1 ? '' : 's'}`
            : 'Log an expense'
        }
        variant="secondary"
        onPress={onOpenExpenses}
      />

      <Button title="Remove stop" variant="danger" onPress={onRemoveStop} />
    </ScrollView>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: 'over';
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasis === 'over' && styles.rowValueOver]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  tabBar: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxl },
  gapped: { gap: spacing.md },
  rows: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  rowValueOver: { color: colors.over },
  plannedNote: { fontSize: 12, color: colors.textFaint, lineHeight: 17 },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  missingText: { color: colors.textMuted, textAlign: 'center' },
});

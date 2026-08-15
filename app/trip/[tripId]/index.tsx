import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stopSummary, tripTotals, tripWarning } from '../../../src/budget/engine';
import { formatMoney } from '../../../src/budget/money';
import { BudgetBar } from '../../../src/components/BudgetBar';
import { MapWithRoute } from '../../../src/components/MapWithRoute';
import { StopList } from '../../../src/components/StopList';
import { Button, EmptyState, Fab, Loading, SegmentedControl } from '../../../src/components/ui';
import { formatDateRange } from '../../../src/dates';
import { useTripStore } from '../../../src/state/tripStore';
import { colors, spacing } from '../../../src/theme';

type ViewMode = 'list' | 'map';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, stops, activities, foodPlans, expenses, loading, open, reorderStops } =
    useTripStore();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<ViewMode>('list');

  useFocusEffect(
    useCallback(() => {
      void open(tripId).then(() => setReady(true));
    }, [tripId, open]),
  );

  const totals = useMemo(
    () => (trip ? tripTotals(trip, stops, activities, foodPlans, expenses) : null),
    [trip, stops, activities, foodPlans, expenses],
  );

  const summaryByStop = useMemo(() => {
    const map = new Map<string, ReturnType<typeof stopSummary>>();
    for (const summary of totals?.stops ?? []) map.set(summary.stop.id, summary);
    return map;
  }, [totals]);

  if (loading || !ready) return <Loading />;

  if (!trip || !totals) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This trip no longer exists.</Text>
        <Button title="Back to trips" variant="secondary" onPress={() => router.replace('/trips')} />
      </View>
    );
  }

  const warning = tripWarning(totals);

  const header = (
    <View style={styles.header}>
      <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>

      <SegmentedControl<ViewMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: 'Itinerary' },
          { value: 'map', label: 'Map' },
        ]}
      />

      {warning ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      {mode === 'list' && stops.length > 1 ? (
        <Text style={styles.hint}>Drag a handle to reorder stops.</Text>
      ) : null}
      {mode === 'map' && stops.length > 0 ? (
        <Text style={styles.hint}>Tap a pin, then its label, to open that stop.</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: trip.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/trip/${tripId}/dashboard`)}
              >
                <Text style={styles.headerAction}>Charts</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/new-trip?tripId=${trip.id}`)}
              >
                <Text style={styles.headerAction}>Edit</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {mode === 'map' ? (
        <View style={styles.mapMode}>
          <View style={styles.mapHeader}>{header}</View>
          <MapWithRoute
            stops={stops}
            onPressStop={(stop) => router.push(`/trip/${tripId}/place/${stop.id}`)}
            style={styles.map}
          />
        </View>
      ) : (
        <StopList
          stops={stops}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              title="No stops yet"
              body="Add the places this trip passes through — each one gets its own activities, food plan and budget."
              action={
                <Button
                  title="Add a stop"
                  onPress={() => router.push(`/trip/${tripId}/new-place`)}
                />
              }
            />
          }
          onPressStop={(stop) => router.push(`/trip/${tripId}/place/${stop.id}`)}
          onReorder={(ids) => void reorderStops(ids)}
          renderSubtitle={(stop) => {
            const activityCount = activities.filter((a) => a.stopId === stop.id).length;
            const foodCount = foodPlans.filter((f) => f.stopId === stop.id).length;
            return `${activityCount} ${activityCount === 1 ? 'activity' : 'activities'} · ${foodCount} food ${foodCount === 1 ? 'spot' : 'spots'}`;
          }}
          renderFooter={(stop) => {
            const summary = summaryByStop.get(stop.id);
            if (!summary) return null;
            return (
              <BudgetBar
                actual={summary.actual}
                cap={summary.budget}
                planned={summary.planned}
                currency={trip.currency}
                compact
              />
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <BudgetBar
          label="Trip total"
          actual={totals.totalActual}
          cap={totals.totalBudget}
          planned={totals.totalPlanned}
          currency={trip.currency}
        />
        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/trip/${tripId}/expenses`)}
          >
            <Text style={styles.footerLink}>
              {expenses.length === 0
                ? 'Log an expense'
                : expenses.length === 1
                  ? '1 expense'
                  : `${expenses.length} expenses`}
            </Text>
          </Pressable>
          <Text style={styles.footerRemaining}>
            {totals.remainingBudget === null
              ? `Planned ${formatMoney(totals.totalPlanned, trip.currency, { compact: true })}`
              : `${formatMoney(totals.remainingBudget, trip.currency, { compact: true })} left`}
          </Text>
        </View>
      </View>

      {stops.length > 0 && mode === 'list' ? (
        <Fab label="Add stop" onPress={() => router.push(`/trip/${tripId}/new-place`)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingBottom: spacing.lg, gap: spacing.md },
  dates: { fontSize: 14, color: colors.textMuted },
  warning: {
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    padding: spacing.md,
  },
  warningText: { color: colors.over, fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textFaint },
  listContent: { paddingBottom: 150 },
  mapMode: { flex: 1, paddingBottom: 140 },
  mapHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  map: { flex: 1, marginHorizontal: spacing.lg, borderRadius: 14 },
  headerActions: { flexDirection: 'row', gap: spacing.lg },
  headerAction: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLink: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  footerRemaining: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  missingText: { color: colors.textMuted },
});

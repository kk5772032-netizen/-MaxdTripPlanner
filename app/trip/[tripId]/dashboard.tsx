import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { actualByCategory, tripTotals, tripWarning } from '../../../src/budget/engine';
import { formatMoney } from '../../../src/budget/money';
import { BudgetBar } from '../../../src/components/BudgetBar';
import { CategoryPie } from '../../../src/components/charts/CategoryPie';
import { PlannedVsActualChart } from '../../../src/components/charts/PlannedVsActualChart';
import { Button, Card, EmptyState, Notice, SkeletonList } from '../../../src/components/ui';
import { useTripStore } from '../../../src/state/tripStore';
import { elevation, makeStyles, radius, spacing, type } from '../../../src/theme';

export default function DashboardScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, stops, activities, foodPlans, expenses, loading, open } = useTripStore();
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void open(tripId).then(() => setReady(true));
    }, [tripId, open]),
  );

  const totals = useMemo(
    () => (trip ? tripTotals(trip, stops, activities, foodPlans, expenses) : null),
    [trip, stops, activities, foodPlans, expenses],
  );

  const byCategory = useMemo(() => actualByCategory(expenses), [expenses]);

  if ((loading && !ready) || !trip || !totals) return <SkeletonList rows={3} />;

  const warning = tripWarning(totals);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* The headline: one number, big, because it's the question people open
          this screen to answer. */}
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>
          {totals.remainingBudget === null ? 'Total spent' : 'Remaining budget'}
        </Text>
        <Text
          style={[
            styles.heroValue,
            totals.remainingBudget !== null && totals.remainingBudget < 0 && styles.heroValueOver,
          ]}
        >
          {formatMoney(
            totals.remainingBudget === null ? totals.totalActual : totals.remainingBudget,
            trip.currency,
            { compact: true },
          )}
        </Text>

        <BudgetBar
          actual={totals.totalActual}
          cap={totals.totalBudget}
          planned={totals.totalPlanned}
          currency={trip.currency}
          style={styles.heroBar}
        />

        {warning ? <Notice tone="warning" body={warning} /> : null}
      </Card>

      <View style={styles.statRow}>
        <Stat label="Budget" value={formatMoney(totals.totalBudget, trip.currency, { compact: true })} />
        <Stat label="Planned" value={formatMoney(totals.totalPlanned, trip.currency, { compact: true })} />
        <Stat label="Actual" value={formatMoney(totals.totalActual, trip.currency, { compact: true })} />
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Planned vs actual per stop</Text>
        {totals.stops.length === 0 ? (
          <EmptyState
            icon="bar-chart-outline"
            title="No stops yet"
            body="Add stops to see how each one is tracking."
          />
        ) : (
          <PlannedVsActualChart stops={totals.stops} currency={trip.currency} />
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Where the money went</Text>
        <CategoryPie totals={byCategory} currency={trip.currency} />
        {totals.unassignedActual > 0 ? (
          <Text style={styles.footnote}>
            {formatMoney(totals.unassignedActual, trip.currency, { compact: true })} of this
            isn&apos;t tied to a stop — flights, visas and the like.
          </Text>
        ) : null}
      </Card>

      <Button
        title="See trip recap"
        variant="secondary"
        icon="ribbon-outline"
        onPress={() => router.push(`/trip/${tripId}/recap`)}
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { gap: spacing.sm },
  heroLabel: { ...type.label, color: t.textMuted },
  heroValue: { ...type.display, fontSize: 34, lineHeight: 40, color: t.text },
  heroValueOver: { color: t.overText },
  heroBar: { marginTop: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: spacing.md,
    gap: 2,
    ...elevation.sm,
  },
  statLabel: { ...type.captionStrong, color: t.textMuted },
  statValue: { ...type.heading, color: t.text },
  section: { gap: spacing.lg },
  sectionTitle: { ...type.heading, color: t.text },
  footnote: { ...type.caption, color: t.textFaint },
}));

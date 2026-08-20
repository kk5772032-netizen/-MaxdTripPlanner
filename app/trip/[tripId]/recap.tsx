import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { actualByCategory, tripTotals } from '../../../src/budget/engine';
import { formatMoney } from '../../../src/budget/money';
import { CategoryPie } from '../../../src/components/charts/CategoryPie';
import { Button, Card, EmptyState, SkeletonList } from '../../../src/components/ui';
import { dayCount, formatDateRange } from '../../../src/dates';
import { useTripStore } from '../../../src/state/tripStore';
import {
  categoryColors,
  categoryIcons,
  colors,
  elevation,
  radius,
  spacing,
  statusColor,
  type,
} from '../../../src/theme';

/**
 * What the trip actually cost, after it's over.
 *
 * Deliberately blame-free: the headline sits on brand blue whether you came in
 * under or over, because a red screen at the end of a holiday is a punishment,
 * not information.
 */
export default function TripRecapScreen() {
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

  const biggest = useMemo(
    () => expenses.reduce<typeof expenses[number] | null>(
      (max, e) => (!max || e.amountMinor > max.amountMinor ? e : max), null),
    [expenses],
  );

  if ((loading && !ready) || !trip || !totals) return <SkeletonList rows={3} />;

  if (expenses.length === 0) {
    return (
      <View style={styles.blank}>
        <EmptyState
          icon="receipt-outline"
          title="Nothing was logged"
          body="This trip has no expenses, so there's nothing to recap."
          action={<Button title="Back to trip" variant="secondary" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  const days = dayCount(trip.startDate, trip.endDate);
  const over = totals.remainingBudget !== null && totals.remainingBudget < 0;
  const diff = totals.remainingBudget === null ? null : Math.abs(totals.remainingBudget);
  const perDay = days && days > 0 ? Math.round(totals.totalActual / days) : null;
  const stopName = (id: string | null) =>
    id ? stops.find((s) => s.id === id)?.name ?? 'Whole trip' : 'Whole trip';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {trip.startDate || trip.endDate ? (
          <Text style={styles.eyebrow}>
            {formatDateRange(trip.startDate, trip.endDate).toUpperCase()}
          </Text>
        ) : null}
        <Text style={styles.heroTitle}>
          {diff === null
            ? `You spent ${formatMoney(totals.totalActual, trip.currency, { compact: true })}.`
            : over
              ? `You went ${formatMoney(diff, trip.currency, { compact: true })} over.`
              : `You came in ${formatMoney(diff, trip.currency, { compact: true })} under.`}
        </Text>
        {totals.totalBudget !== null ? (
          <Text style={styles.heroSub}>
            {formatMoney(totals.totalActual, trip.currency, { compact: true })} spent of a{' '}
            {formatMoney(totals.totalBudget, trip.currency, { compact: true })} budget.
          </Text>
        ) : (
          <Text style={styles.heroSub}>No budget was set for this trip.</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.statRow}>
          <Stat value={String(stops.length)} label={stops.length === 1 ? 'stop' : 'stops'} />
          <Stat value={String(expenses.length)} label={expenses.length === 1 ? 'expense' : 'expenses'} />
          {perDay !== null ? (
            <Stat value={formatMoney(perDay, trip.currency, { compact: true })} label="a day" />
          ) : null}
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Where the money went</Text>
          <CategoryPie totals={byCategory} currency={trip.currency} size={150} />
        </Card>

        {biggest ? (
          <Card style={styles.card}>
            <Text style={styles.cardLabel}>Biggest single expense</Text>
            <View style={styles.biggest}>
              <View
                style={[styles.catTile, { backgroundColor: `${categoryColors[biggest.category]}18` }]}
              >
                <Ionicons
                  name={categoryIcons[biggest.category] as never}
                  size={18}
                  color={categoryColors[biggest.category]}
                />
              </View>
              <View style={styles.biggestText}>
                <Text style={styles.biggestTitle} numberOfLines={1}>
                  {biggest.note?.trim() || 'Untitled expense'}
                </Text>
                <Text style={styles.biggestMeta}>{stopName(biggest.stopId)}</Text>
              </View>
              <Text style={styles.biggestAmount}>
                {formatMoney(biggest.amountMinor, trip.currency)}
              </Text>
            </View>
          </Card>
        ) : null}

        {totals.stops.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>By stop</Text>
            {totals.stops.map((s) => {
              const pct = s.budget && s.budget > 0
                ? Math.min(100, (s.actual / s.budget) * 100) : 0;
              return (
                <View key={s.stop.id} style={styles.stopRow}>
                  <View style={styles.stopHead}>
                    <Text style={styles.stopName} numberOfLines={1}>{s.stop.name}</Text>
                    <Text style={styles.stopFigures}>
                      {s.budget === null
                        ? formatMoney(s.actual, trip.currency, { compact: true })
                        : `${formatMoney(s.actual, trip.currency, { compact: true })} of ${formatMoney(s.budget, trip.currency, { compact: true })}`}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[styles.fill, { width: `${pct}%`, backgroundColor: statusColor[s.status] }]}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}

        <Button
          title="Back to trip"
          variant="secondary"
          icon="arrow-back"
          onPress={() => router.back()}
        />
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={[styles.stat, elevation.sm]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  blank: { flex: 1, justifyContent: 'center' },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    gap: spacing.sm,
  },
  eyebrow: { ...type.captionStrong, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  heroTitle: { ...type.display, color: '#fff' },
  heroSub: { ...type.body, color: 'rgba(255,255,255,0.82)' },
  body: { padding: spacing.lg, gap: spacing.lg },
  statRow: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  statValue: { ...type.heading, color: colors.text },
  statLabel: { ...type.captionStrong, color: colors.textMuted },
  card: { gap: spacing.lg },
  cardTitle: { ...type.heading, color: colors.text },
  cardLabel: { ...type.label, color: colors.textMuted },
  biggest: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  catTile: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  biggestText: { flex: 1, gap: 1 },
  biggestTitle: { ...type.bodyStrong, color: colors.text },
  biggestMeta: { ...type.caption, color: colors.textMuted },
  biggestAmount: { ...type.amount, color: colors.text },
  stopRow: { gap: 5 },
  stopHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  stopName: { ...type.label, color: colors.text, flex: 1 },
  stopFigures: { ...type.caption, color: colors.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});

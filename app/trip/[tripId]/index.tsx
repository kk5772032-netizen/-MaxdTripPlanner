import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tripTotals, tripWarning } from '../../../src/budget/engine';
import { formatMoney } from '../../../src/budget/money';
import { BudgetBar } from '../../../src/components/BudgetBar';
import { DayTimeline } from '../../../src/components/itinerary/DayTimeline';
import { MapWithRoute } from '../../../src/components/MapWithRoute';
import {
  Button,
  EmptyState,
  Fab,
  HeaderAction,
  Notice,
  SegmentedControl,
  SkeletonList,
} from '../../../src/components/ui';
import { formatDateRange } from '../../../src/dates';
import { tripDays } from '../../../src/itinerary/schedule';
import { useTripStore } from '../../../src/state/tripStore';
import { elevation, makeStyles, radius, spacing, type, useTheme } from '../../../src/theme';

type ViewMode = 'list' | 'map';

export default function TripDetailScreen() {
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const { trip, stops, activities, foodPlans, expenses, bookings, loading, open } =
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

  if (loading || !ready) return <SkeletonList rows={3} />;

  if (!trip || !totals) {
    return (
      <View style={styles.missing}>
        <EmptyState
          icon="alert-circle-outline"
          title="Trip not found"
          body="This trip no longer exists."
          action={
            <Button
              title="Back to trips"
              variant="secondary"
              onPress={() => router.replace('/trips')}
            />
          }
        />
      </View>
    );
  }

  const warning = tripWarning(totals);
  // A dated trip with no stops still shows its days: empty days are the
  // invitation to plan, and an empty state there would hide the whole point.
  const hasPlan = tripDays(trip).length > 0 || stops.length > 0;
  // The sticky footer's own height, so the list and FAB can clear it.
  const footerHeight = 104 + insets.bottom;

  const header = (
    <View style={styles.header}>
      <View style={styles.datesRow}>
        <Ionicons name="calendar-outline" size={14} color={t.textFaint} />
        <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
      </View>

      <SegmentedControl<ViewMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: 'Itinerary', icon: 'list' },
          { value: 'map', label: 'Map', icon: 'map-outline' },
        ]}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open bookings"
        onPress={() => router.push(`/trip/${tripId}/bookings`)}
        style={({ pressed }) => [styles.bookingsLink, pressed && styles.pressed]}
      >
        <Ionicons name="bookmark-outline" size={16} color={t.primary} />
        <Text style={styles.bookingsText}>
          {bookings.length === 0
            ? 'Flights, hotels and reservations'
            : `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
      </Pressable>

      {warning ? <Notice tone="warning" body={warning} /> : null}

    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: trip.name,
          headerRight: () => (
            <HeaderAction
              label="Edit"
              icon="create-outline"
              onPress={() => router.push(`/new-trip?tripId=${trip.id}`)}
            />
          ),
        }}
      />

      {mode === 'map' ? (
        <View style={[styles.mapMode, { paddingBottom: footerHeight }]}>
          <View style={styles.mapHeader}>{header}</View>
          <MapWithRoute
            stops={stops}
            onPressStop={(stop) => router.push(`/trip/${tripId}/place/${stop.id}`)}
            style={styles.map}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: footerHeight + spacing.xl },
          ]}
        >
          {header}

          {!hasPlan ? (
            <EmptyState
              icon="location-outline"
              title="No stops yet"
              body="Add the places this trip passes through — each one gets its own day, things to do and a food plan."
              action={
                <Button
                  title="Add a stop"
                  icon="add"
                  onPress={() => router.push(`/trip/${tripId}/new-place`)}
                />
              }
            />
          ) : (
            <DayTimeline
              trip={trip}
              stops={stops}
              activities={activities}
              foodPlans={foodPlans}
              onPressStop={(stop) => router.push(`/trip/${tripId}/place/${stop.id}`)}
              onAddStop={(dayDate) =>
                router.push(
                  `/trip/${tripId}/new-place${dayDate ? `?day=${dayDate}` : ''}`,
                )
              }
            />
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, elevation.lg, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open budget dashboard"
          onPress={() => router.push(`/trip/${tripId}/dashboard`)}
        >
          <BudgetBar
            label="Trip total"
            actual={totals.totalActual}
            cap={totals.totalBudget}
            planned={totals.totalPlanned}
            currency={trip.currency}
          />
        </Pressable>

        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/trip/${tripId}/expenses`)}
            style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
          >
            <Ionicons name="receipt-outline" size={15} color={t.primary} />
            <Text style={styles.footerLinkText}>
              {expenses.length === 0
                ? 'Log an expense'
                : expenses.length === 1
                  ? '1 expense'
                  : `${expenses.length} expenses`}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/trip/${tripId}/dashboard`)}
            style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
          >
            <Text style={styles.footerRemaining}>
              {totals.remainingBudget === null
                ? `Planned ${formatMoney(totals.totalPlanned, trip.currency, { compact: true })}`
                : `${formatMoney(totals.remainingBudget, trip.currency, { compact: true })} left`}
            </Text>
            <Ionicons name="stats-chart" size={15} color={t.primary} />
          </Pressable>
        </View>
      </View>

      {stops.length > 0 && mode === 'list' ? (
        <Fab
          label="Add stop"
          onPress={() => router.push(`/trip/${tripId}/new-place`)}
          offsetBottom={footerHeight + spacing.md}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.bg },
  header: { paddingBottom: spacing.lg, gap: spacing.md },
  listContent: { padding: spacing.lg },
  bookingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  bookingsText: { flex: 1, ...type.label, color: t.text },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dates: { ...type.caption, color: t.textMuted },
  hint: { ...type.caption, color: t.textFaint },
  mapMode: { flex: 1 },
  mapHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  map: { flex: 1, marginHorizontal: spacing.lg, borderRadius: radius.lg },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  footerLinkText: { ...type.label, color: t.primary },
  footerRemaining: { ...type.label, color: t.primary },
  pressed: { opacity: 0.6 },
  missing: { flex: 1, justifyContent: 'center' },
}));

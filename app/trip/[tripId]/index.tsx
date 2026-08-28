import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tripTotals, tripWarning } from '../../../src/budget/engine';
import { formatMoney } from '../../../src/budget/money';
import { BudgetBar } from '../../../src/components/BudgetBar';
import { BookingsSection } from '../../../src/components/bookings/BookingsSection';
import { BudgetSection } from '../../../src/components/budget/BudgetSection';
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

/**
 * The four things a trip is. Budget is one of them, not the frame around the
 * others: it used to be a sticky bar over every screen plus a tab on every
 * stop, which made a planning tool read as an expense tracker.
 */
type Section = 'itinerary' | 'map' | 'bookings' | 'budget';

export default function TripDetailScreen() {
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const { trip, stops, activities, foodPlans, expenses, bookings, loading, open } =
    useTripStore();
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<Section>('itinerary');

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

  const header = (
    <View style={styles.header}>
      <View style={styles.datesRow}>
        <Ionicons name="calendar-outline" size={14} color={t.textFaint} />
        <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
      </View>

      <SegmentedControl<Section>
        value={section}
        onChange={setSection}
        options={[
          { value: 'itinerary', label: 'Plan', icon: 'list' },
          { value: 'map', label: 'Map', icon: 'map-outline' },
          { value: 'bookings', label: 'Booked', icon: 'bookmark-outline' },
          { value: 'budget', label: 'Money', icon: 'wallet-outline' },
        ]}
      />

      {/* The over-budget warning belongs with the money, not over the plan. */}
      {warning && section === 'budget' ? <Notice tone="warning" body={warning} /> : null}
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

      {section === 'map' ? (
        <View style={styles.mapMode}>
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
            { paddingBottom: spacing.xxl + insets.bottom },
          ]}
        >
          {header}

          {section === 'itinerary' ? (
            hasPlan ? (
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
            ) : (
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
            )
          ) : null}

          {section === 'bookings' ? <BookingsSection trip={trip} /> : null}

          {section === 'budget' ? (
            <BudgetSection
              trip={trip}
              totals={totals}
              expenseCount={expenses.length}
              warning={null}
            />
          ) : null}
        </ScrollView>
      )}

      {/* The FAB adds a stop, so it belongs to the plan and nowhere else. */}
      {stops.length > 0 && section === 'itinerary' ? (
        <Fab
          label="Add stop"
          onPress={() => router.push(`/trip/${tripId}/new-place`)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.bg },
  header: { paddingBottom: spacing.lg, gap: spacing.md },
  listContent: { padding: spacing.lg },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dates: { ...type.caption, color: t.textMuted },
  hint: { ...type.caption, color: t.textFaint },
  mapMode: { flex: 1 },
  mapHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  map: { flex: 1, marginHorizontal: spacing.lg, borderRadius: radius.lg },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  footerRemaining: { ...type.label, color: t.primary },
  pressed: { opacity: 0.6 },
  missing: { flex: 1, justifyContent: 'center' },
}));

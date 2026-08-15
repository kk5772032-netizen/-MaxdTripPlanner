import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../src/budget/money';
import { BudgetRing } from '../../src/components/BudgetRing';
import { Button, EmptyState, Fab, Loading } from '../../src/components/ui';
import { formatDateRange } from '../../src/dates';
import { useTripsStore } from '../../src/state/tripsStore';
import { colors, radius, spacing } from '../../src/theme';
import type { Trip } from '../../src/types';

export default function TripsScreen() {
  const router = useRouter();
  const { trips, actualByTrip, loading, error, load, remove } = useTripsStore();

  // Reload on focus: coming back from trip detail, budgets and stop counts may
  // have changed.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmDelete = (trip: Trip) => {
    Alert.alert('Delete trip?', `"${trip.name}" and everything in it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(trip.id) },
    ]);
  };

  if (loading && trips.length === 0) return <Loading />;

  return (
    <View style={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={
          trips.length === 0 ? styles.listEmpty : styles.listContent
        }
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            actual={actualByTrip[item.id] ?? 0}
            onPress={() => router.push(`/trip/${item.id}`)}
            onLongPress={() => confirmDelete(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No trips yet"
            body="Plan a trip as a sequence of stops — what to do, where to eat, and what it should cost."
            action={
              <Button title="Create your first trip" onPress={() => router.push('/new-trip')} />
            }
          />
        }
      />

      {trips.length > 0 ? (
        <Fab label="New trip" onPress={() => router.push('/new-trip')} />
      ) : null}
    </View>
  );
}

function TripCard({
  trip,
  actual,
  onPress,
  onLongPress,
}: {
  trip: Trip;
  actual: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {trip.name}
        </Text>
        <Text style={styles.cardMeta}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
        <Text style={styles.cardBudget}>
          {trip.totalBudgetMinor === null
            ? `${formatMoney(actual, trip.currency, { compact: true })} spent`
            : `${formatMoney(actual, trip.currency, { compact: true })} of ${formatMoney(trip.totalBudgetMinor, trip.currency, { compact: true })}`}
        </Text>
      </View>
      <BudgetRing actual={actual} cap={trip.totalBudgetMinor} />
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 96 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  error: {
    color: colors.over,
    padding: spacing.lg,
    fontSize: 13,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardPressed: { opacity: 0.9 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted },
  cardBudget: { fontSize: 13, color: colors.textFaint },
  chevron: { fontSize: 26, color: colors.textFaint, lineHeight: 28 },
});

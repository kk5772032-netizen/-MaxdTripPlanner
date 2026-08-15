import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../../src/budget/money';
import { StopList } from '../../../src/components/StopList';
import { Button, EmptyState, Fab, Loading } from '../../../src/components/ui';
import { formatDateRange } from '../../../src/dates';
import { useTripStore } from '../../../src/state/tripStore';
import { useTripsStore } from '../../../src/state/tripsStore';
import { colors, spacing } from '../../../src/theme';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const removeTrip = useTripsStore((s) => s.remove);

  const { trip, stops, loading, open, reorderStops } = useTripStore();
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void open(tripId).then(() => setReady(true));
    }, [tripId, open]),
  );

  const confirmDeleteTrip = () => {
    if (!trip) return;
    Alert.alert('Delete trip?', `"${trip.name}" and everything in it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeTrip(trip.id);
          router.replace('/trips');
        },
      },
    ]);
  };

  if (loading || !ready) return <Loading />;

  if (!trip) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This trip no longer exists.</Text>
        <Button title="Back to trips" variant="secondary" onPress={() => router.replace('/trips')} />
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
      <Text style={styles.budget}>
        {trip.totalBudgetMinor === null
          ? 'No overall budget set'
          : `Budget ${formatMoney(trip.totalBudgetMinor, trip.currency, { compact: true })}`}
      </Text>
      {stops.length > 1 ? (
        <Text style={styles.hint}>Drag the handle to reorder stops.</Text>
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
                onPress={() => router.push(`/new-trip?tripId=${trip.id}`)}
              >
                <Text style={styles.headerAction}>Edit</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={confirmDeleteTrip}>
                <Text style={[styles.headerAction, styles.headerDanger]}>Delete</Text>
              </Pressable>
            </View>
          ),
        }}
      />

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
        renderSubtitle={(stop) =>
          stop.plannedBudgetMinor !== null
            ? `Cap ${formatMoney(stop.plannedBudgetMinor, trip.currency, { compact: true })}`
            : undefined
        }
      />

      {stops.length > 0 ? (
        <Fab label="Add stop" onPress={() => router.push(`/trip/${tripId}/new-place`)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingBottom: spacing.lg, gap: 2 },
  dates: { fontSize: 14, color: colors.textMuted },
  budget: { fontSize: 14, color: colors.text, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: spacing.sm },
  headerActions: { flexDirection: 'row', gap: spacing.lg },
  headerAction: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  headerDanger: { color: colors.over },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  missingText: { color: colors.textMuted },
});

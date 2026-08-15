import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../../src/budget/money';
import { Button, Card, Loading } from '../../../src/components/ui';
import { dayCount, formatDateRange } from '../../../src/dates';
import * as tripsRepo from '../../../src/db/repositories/trips';
import { useTripsStore } from '../../../src/state/tripsStore';
import { colors, spacing } from '../../../src/theme';
import type { Trip } from '../../../src/types';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const remove = useTripsStore((s) => s.remove);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void tripsRepo.getTrip(tripId).then((t) => {
        if (cancelled) return;
        setTrip(t);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [tripId]),
  );

  const confirmDelete = () => {
    if (!trip) return;
    Alert.alert('Delete trip?', `"${trip.name}" and everything in it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(trip.id);
          router.replace('/trips');
        },
      },
    ]);
  };

  if (loading) return <Loading />;

  if (!trip) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This trip no longer exists.</Text>
        <Button title="Back to trips" variant="secondary" onPress={() => router.replace('/trips')} />
      </View>
    );
  }

  const days = dayCount(trip.startDate, trip.endDate);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: trip.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/new-trip?tripId=${trip.id}`)}
            >
              <Text style={styles.headerAction}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      <Card>
        <Text style={styles.label}>Dates</Text>
        <Text style={styles.value}>
          {formatDateRange(trip.startDate, trip.endDate)}
          {days ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Total budget</Text>
        <Text style={styles.value}>
          {trip.totalBudgetMinor === null
            ? 'Not set'
            : formatMoney(trip.totalBudgetMinor, trip.currency)}
        </Text>
      </Card>

      <Button title="Delete trip" variant="danger" onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  value: { fontSize: 16, color: colors.text },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  headerAction: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  missingText: { color: colors.textMuted },
});

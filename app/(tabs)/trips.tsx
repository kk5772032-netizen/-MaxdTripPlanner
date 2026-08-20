import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { statusFor } from '../../src/budget/engine';
import { confirmDestructive } from '../../src/confirm';
import { formatMoney } from '../../src/budget/money';
import { BudgetRing } from '../../src/components/BudgetRing';
import {
  Button,
  EmptyState,
  Fab,
  Notice,
  SkeletonList,
} from '../../src/components/ui';
import { dayCount, formatDateRange } from '../../src/dates';
import { useTripsStore } from '../../src/state/tripsStore';
import { elevation, makeStyles, radius, spacing, statusSoftOf, statusTextOf, type, useTheme } from '../../src/theme';
import type { Trip } from '../../src/types';

export default function TripsScreen() {
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips, actualByTrip, stopCountByTrip, loading, error, load, remove } =
    useTripsStore();

  // Reload on focus: coming back from trip detail, budgets and stop counts may
  // have changed.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmDelete = async (trip: Trip) => {
    const ok = await confirmDestructive({
      title: 'Delete trip?',
      message: `"${trip.name}" and everything in it will be removed.`,
    });
    if (ok) await remove(trip.id);
  };

  if (loading && trips.length === 0) return <SkeletonList rows={3} />;

  return (
    <View style={styles.screen}>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={
          trips.length === 0
            ? styles.listEmpty
            : [styles.listContent, { paddingBottom: 96 + insets.bottom }]
        }
        ListHeaderComponent={
          error ? (
            <Notice tone="danger" title="Couldn't load your trips" body={error} />
          ) : null
        }
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            actual={actualByTrip[item.id] ?? 0}
            stopCount={stopCountByTrip[item.id] ?? 0}
            onPress={() => router.push(`/trip/${item.id}`)}
            onLongPress={() => void confirmDelete(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="map-outline"
            title="No trips yet"
            body="Plan a trip as a sequence of stops — what to do, where to eat, and what it should cost."
            action={
              <Button
                title="Create your first trip"
                icon="add"
                onPress={() => router.push('/new-trip')}
              />
            }
          />
        }
      />

      {trips.length > 0 ? (
        <Fab
          label="New trip"
          onPress={() => router.push('/new-trip')}
          offsetBottom={spacing.xl + insets.bottom}
        />
      ) : null}
    </View>
  );
}

function TripCard({
  trip,
  actual,
  stopCount,
  onPress,
  onLongPress,
}: {
  trip: Trip;
  actual: number;
  stopCount: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const status = statusFor(actual, trip.totalBudgetMinor);
  const days = dayCount(trip.startDate, trip.endDate);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.name}, ${stopCount} stops`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, elevation.sm, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {trip.name}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={t.textFaint} />
            <Text style={styles.cardMeta} numberOfLines={1}>
              {formatDateRange(trip.startDate, trip.endDate)}
              {days ? ` · ${days}d` : ''}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={t.textFaint} />
            <Text style={styles.cardMeta}>
              {stopCount === 1 ? '1 stop' : `${stopCount} stops`}
            </Text>
          </View>
        </View>

        <BudgetRing actual={actual} cap={trip.totalBudgetMinor} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardSpend}>
          {trip.totalBudgetMinor === null
            ? `${formatMoney(actual, trip.currency, { compact: true })} spent`
            : `${formatMoney(actual, trip.currency, { compact: true })} of ${formatMoney(trip.totalBudgetMinor, trip.currency, { compact: true })}`}
        </Text>

        {status !== 'unset' ? (
          <View style={[styles.badge, { backgroundColor: statusSoftOf(t, status) }]}>
            <Text style={[styles.badgeText, { color: statusTextOf(t, status) }]}>
              {status === 'over' ? 'Over budget' : status === 'near' ? 'Close to cap' : 'On track'}
            </Text>
          </View>
        ) : (
          <Text style={styles.noBudget}>No budget set</Text>
        )}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.bg },
  listContent: { padding: spacing.lg, gap: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardBody: { flex: 1, gap: spacing.xs },
  cardTitle: { ...type.heading, color: t.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardMeta: { ...type.caption, color: t.textMuted, flexShrink: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.border,
    paddingTop: spacing.md,
  },
  cardSpend: { ...type.label, color: t.text },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { ...type.captionStrong },
  noBudget: { ...type.caption, color: t.textFaint },
}));

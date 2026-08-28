import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
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
import { PhotoStrip } from '../../../../src/components/places/PhotoStrip';
import { PlaceFacts } from '../../../../src/components/places/PlaceFacts';
import { FoodTab } from '../../../../src/components/stop/FoodTab';
import { ScheduleControls } from '../../../../src/components/itinerary/ScheduleControls';
import { StopNotes } from '../../../../src/components/stop/StopNotes';
import { BudgetBar } from '../../../../src/components/BudgetBar';
import { AmountInput } from '../../../../src/components/AmountInput';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Notice,
  SegmentedControl,
  SkeletonList,
  notifySuccess,
} from '../../../../src/components/ui';
import { directionsUrl, openInMaps, placeUrl } from '../../../../src/places/maps';
import { usePlaceContent } from '../../../../src/places/usePlaceContent';
import { useTripStore } from '../../../../src/state/tripStore';
import { makeStyles, spacing, type, useTheme } from '../../../../src/theme';

type Tab = 'activities' | 'food' | 'overview';

export default function StopDetailScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { tripId, placeId } = useLocalSearchParams<{ tripId: string; placeId: string }>();
  const [tab, setTab] = useState<Tab>('activities');

  const { trip, loading, open, removeStop, updateStop } = useTripStore();

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

  const removeThisStop = async () => {
    if (!stop) return;
    // No dialog: removal is fully reversible for a few seconds via the toast,
    // which is faster than confirming and safer than a silent delete.
    await removeStop(stop.id);
    router.back();
  };

  if (loading && !stop) return <SkeletonList rows={2} />;

  if (!stop || !trip || !summary) {
    return (
      <View style={styles.missing}>
        <EmptyState
          icon="alert-circle-outline"
          title="Stop not found"
          body="This stop is no longer part of the trip."
          action={<Button title="Back" variant="secondary" onPress={() => router.back()} />}
        />
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
        <ScheduleControls
          trip={trip}
          stop={stop}
          onChange={(patch) => void updateStop(stop.id, patch)}
        />

        <StopNotes stop={stop} />

        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            {
              value: 'activities',
              label: activities.length ? `To do ${activities.length}` : 'To do',
              icon: 'checkbox-outline',
            },
            {
              value: 'food',
              label: foodPlans.length ? `Food ${foodPlans.length}` : 'Food',
              icon: 'restaurant-outline',
            },
            { value: 'overview', label: 'Details', icon: 'information-circle-outline' },
          ]}
        />
      </View>

      {tab === 'activities' ? (
        <ActivitiesTab stop={stop} currency={trip.currency} activities={activities} />
      ) : null}

      {tab === 'food' ? (
        <FoodTab stop={stop} currency={trip.currency} foodPlans={foodPlans} />
      ) : null}

      {tab === 'overview' ? (
        <OverviewTab
          currency={trip.currency}
          summary={summary}
          onRemoveStop={() => void removeThisStop()}
          expenseCount={expenses.length}
          onOpenExpenses={() => router.push(`/trip/${tripId}/expenses?stopId=${stop.id}`)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

/**
 * What this stop is, with money as one line rather than the whole tab.
 *
 * The old Budget tab put a cap form and three figures on equal footing with
 * the two planning tabs, which is a third of the stop screen given over to
 * spending. Address, rating and the cap now sit together as stop details.
 */
function OverviewTab({
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
  const styles = useStyles();
  const t = useTheme();
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
      notifySuccess();
    } finally {
      setSaving(false);
    }
  };

  const { stop } = summary;
  const content = usePlaceContent(stop.googlePlaceId);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {content.status === 'ready' ? (
        <PhotoStrip photoRefs={content.details.photoRefs} name={stop.name} />
      ) : null}

      {/* What we always know, from the row in our own database, and what Google
          can add on top. Without a key or a network the first still stands. */}
      {content.status === 'ready' ? (
        <Card style={styles.gapped}>
          <PlaceFacts details={content.details} currency={currency} />
        </Card>
      ) : stop.address || stop.rating !== null ? (
        <Card style={styles.gapped}>
          {stop.address ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={t.textMuted} />
              <Text style={styles.detailText}>{stop.address}</Text>
            </View>
          ) : null}
          {stop.rating !== null ? (
            <View style={styles.detailRow}>
              <Ionicons name="star" size={16} color={t.near} />
              <Text style={styles.detailText}>{stop.rating.toFixed(1)} on Google</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Directions come before anything else on this tab and never depend on
          Places: a stop typed by hand still has a name, and Maps can search on
          a name. This is the button people press while already walking. */}
      <View style={styles.directions}>
        <View style={styles.directionsMain}>
          <Button
            title="Directions"
            icon="navigate"
            onPress={() => void openInMaps(directionsUrl(stop))}
          />
        </View>
        <View style={styles.directionsMain}>
          <Button
            title="View on map"
            icon="map-outline"
            variant="secondary"
            onPress={() => void openInMaps(placeUrl(stop))}
          />
        </View>
      </View>

      {content.status === 'error' ? (
        <Card style={styles.gapped}>
          <Notice tone="warning" body={content.message} />
          <Button
            title="Try again"
            icon="refresh-outline"
            variant="secondary"
            onPress={content.retry}
          />
        </Card>
      ) : null}

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
        <Button title="Save budget" icon="checkmark" onPress={saveCap} loading={saving} />
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
        icon="receipt-outline"
        variant="secondary"
        onPress={onOpenExpenses}
      />

      <Button
        title="Remove stop"
        icon="trash-outline"
        variant="danger"
        onPress={onRemoveStop}
      />
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
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasis === 'over' && styles.rowValueOver]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, backgroundColor: t.bg },
  tabBar: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxl },
  gapped: { gap: spacing.md },
  directions: { flexDirection: 'row', gap: spacing.md },
  directionsMain: { flex: 1 },
  rows: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { ...type.body, color: t.textMuted },
  rowValue: { ...type.amount, color: t.text },
  rowValueOver: { color: t.overText },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailText: { flex: 1, ...type.body, color: t.text },
  plannedNote: { ...type.caption, color: t.textFaint },
  missing: { flex: 1, justifyContent: 'center' },
}));

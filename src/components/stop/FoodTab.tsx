import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlacesError, hasApiKey, nearbyRestaurants } from '../../api/places';
import { formatMoney, parseMoney, sumMinor, toDecimalString } from '../../budget/money';
import { useTripStore } from '../../state/tripStore';
import { elevation, makeStyles, radius, spacing, type } from '../../theme';
import type { FoodPlan, NearbyRestaurant, Stop } from '../../types';
import { AmountInput } from '../AmountInput';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Loading,
  Notice,
  SectionHeader,
} from '../ui';

/**
 * Where to eat at this stop.
 *
 * Nearby Search is the most expensive call in the app, so it runs at most once
 * per stop per 30 days: on the first visit to this tab, or when the user taps
 * Refresh. It never runs on render, and never for a stop with no coordinates.
 */
export function FoodTab({
  stop,
  currency,
  foodPlans,
}: {
  stop: Stop;
  currency: string;
  foodPlans: FoodPlan[];
}) {
  const styles = useStyles();
  const { addFoodPlan, removeFoodPlan } = useTripStore();

  const [nearby, setNearby] = useState<NearbyRestaurant[]>([]);
  const [nearbyState, setNearbyState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const canSearchNearby =
    hasApiKey() && !!stop.googlePlaceId && stop.lat != null && stop.lng != null;

  // One fetch per mount at most. The ref guards against the effect re-running
  // (e.g. a re-render from adding a plan) and firing a second billed request.
  const fetchedRef = useRef(false);

  const loadNearby = useCallback(
    async (forceRefresh: boolean) => {
      if (!canSearchNearby) return;
      setNearbyState('loading');
      setNearbyError(null);
      try {
        const result = await nearbyRestaurants(
          stop.googlePlaceId!,
          { lat: stop.lat!, lng: stop.lng! },
          { forceRefresh },
        );
        setNearby(result.restaurants);
        setStale(result.stale);
        setNearbyState('done');
      } catch (e) {
        setNearbyError(
          e instanceof PlacesError
            ? e.message
            : 'Could not load nearby restaurants. Add one manually instead.',
        );
        setNearbyState('error');
      }
    },
    [canSearchNearby, stop.googlePlaceId, stop.lat, stop.lng],
  );

  useEffect(() => {
    if (fetchedRef.current || !canSearchNearby) return;
    fetchedRef.current = true;
    void loadNearby(false);
  }, [canSearchNearby, loadNearby]);

  const plannedTotal = sumMinor(foodPlans.map((f) => f.estimatedCostMinor));
  const plannedPlaceIds = new Set(
    foodPlans.map((f) => f.googlePlaceId).filter((id): id is string => !!id),
  );

  const addFromNearby = (restaurant: NearbyRestaurant) => {
    void addFoodPlan({
      stopId: stop.id,
      googlePlaceId: restaurant.placeId,
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      // Google's price level is a 0–4 bucket, not an amount — the user fills in
      // what they expect to spend.
      estimatedCostMinor: null,
      notes: null,
    });
  };

  const remove = (plan: FoodPlan) => void removeFoodPlan(plan.id);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {foodPlans.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your food plan</Text>
            <Text style={styles.sectionMeta}>
              Planned {formatMoney(plannedTotal, currency, { compact: true })}
            </Text>
          </View>

          <View style={styles.list}>
            {foodPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                currency={currency}
                onRemove={() => remove(plan)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Restaurants nearby"
          action={
            canSearchNearby && nearbyState !== 'loading'
              ? { label: 'Refresh', icon: 'refresh', onPress: () => void loadNearby(true) }
              : undefined
          }
        />

        {!canSearchNearby ? (
          <Notice
            tone="info"
            title={!hasApiKey() ? 'Place search is off' : 'No coordinates for this stop'}
            body={
              !hasApiKey()
                ? 'Set EXPO_PUBLIC_GOOGLE_PLACES_KEY in .env to see restaurants near this stop.'
                : 'This stop was added by hand, so there is nothing to search around. Add places to eat below.'
            }
          />
        ) : nearbyState === 'loading' ? (
          <Loading label="Finding restaurants nearby…" />
        ) : nearbyState === 'error' ? (
          <Notice tone="danger" title="Couldn't load restaurants" body={nearbyError ?? ''} />
        ) : nearby.length === 0 ? (
          <EmptyState
            icon="restaurant-outline"
            title="No restaurants found"
            body="Nothing came back within 1.5km of this stop. Add somewhere by hand instead."
          />
        ) : (
          <>
            {stale ? (
              <Notice
                tone="warning"
                body="Showing a cached list — couldn't reach Google just now."
              />
            ) : null}
            <View style={styles.list}>
              {nearby.map((restaurant) => (
                <NearbyRow
                  key={restaurant.placeId}
                  restaurant={restaurant}
                  added={plannedPlaceIds.has(restaurant.placeId)}
                  onAdd={() => addFromNearby(restaurant)}
                />
              ))}
            </View>
          </>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setManualOpen((open) => !open)}
        style={styles.manualToggle}
      >
        <Text style={styles.manualToggleText}>
          {manualOpen ? 'Hide manual entry' : 'Add a place manually instead'}
        </Text>
      </Pressable>

      {manualOpen ? (
        <ManualFoodForm stopId={stop.id} currency={currency} onDone={() => setManualOpen(false)} />
      ) : null}
    </ScrollView>
  );
}

function PlanRow({
  plan,
  currency,
  onRemove,
}: {
  plan: FoodPlan;
  currency: string;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const updateFoodPlan = useTripStore((s) => s.updateFoodPlan);
  const [costText, setCostText] = useState(
    toDecimalString(plan.estimatedCostMinor, currency),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={plan.name}
      onLongPress={onRemove}
      style={styles.item}
    >
      <View style={styles.itemMain}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {plan.name}
        </Text>
        {plan.cuisine || plan.notes ? (
          <Text style={styles.itemMeta} numberOfLines={1}>
            {[plan.cuisine, plan.notes].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>

      <AmountInput
        value={costText}
        onChangeText={(text) => {
          setCostText(text);
          void updateFoodPlan(plan.id, { estimatedCostMinor: parseMoney(text, currency) });
        }}
        currency={currency}
        placeholder="Est."
        style={styles.itemAmount}
        accessibilityLabel={`Estimated cost for ${plan.name}`}
      />

      <IconButton
        icon="trash-outline"
        label={`Remove ${plan.name}`}
        tone="danger"
        size={30}
        onPress={onRemove}
      />
    </Pressable>
  );
}

function NearbyRow({
  restaurant,
  added,
  onAdd,
}: {
  restaurant: NearbyRestaurant;
  added: boolean;
  onAdd: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.item}>
      <View style={styles.itemMain}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.itemMeta} numberOfLines={1}>
          {[
            restaurant.cuisine,
            restaurant.rating != null ? `★ ${restaurant.rating.toFixed(1)}` : null,
            restaurant.priceLevel != null ? '₹'.repeat(Math.max(1, restaurant.priceLevel)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={added ? `${restaurant.name} already added` : `Add ${restaurant.name}`}
        disabled={added}
        onPress={onAdd}
        style={[styles.addButton, added && styles.addButtonDone]}
      >
        <Text style={[styles.addButtonText, added && styles.addButtonTextDone]}>
          {added ? 'Added' : 'Add'}
        </Text>
      </Pressable>
    </View>
  );
}

function ManualFoodForm({
  stopId,
  currency,
  onDone,
}: {
  stopId: string;
  currency: string;
  onDone: () => void;
}) {
  const styles = useStyles();
  const addFoodPlan = useTripStore((s) => s.addFoodPlan);
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [costText, setCostText] = useState('');
  const [notes, setNotes] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    await addFoodPlan({
      stopId,
      googlePlaceId: null,
      name: name.trim(),
      cuisine: cuisine.trim() || null,
      estimatedCostMinor: parseMoney(costText, currency),
      notes: notes.trim() || null,
    });
    setName('');
    setCuisine('');
    setCostText('');
    setNotes('');
    onDone();
  };

  return (
    <Card style={styles.form}>
      <Input value={name} onChangeText={setName} placeholder="Karim's" />
      <Input value={cuisine} onChangeText={setCuisine} placeholder="Cuisine (optional)" />
      <Input value={notes} onChangeText={setNotes} placeholder="Note (optional)" />
      <View style={styles.formRow}>
        <AmountInput
          value={costText}
          onChangeText={setCostText}
          currency={currency}
          placeholder="Est. cost"
          style={styles.amount}
          accessibilityLabel="Estimated cost"
        />
        <Button title="Add" onPress={save} disabled={!name.trim()} />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...type.heading, color: t.text },
  sectionMeta: { ...type.label, color: t.textMuted },
  list: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    overflow: 'hidden',
    ...elevation.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  itemMain: { flex: 1, gap: 1 },
  itemTitle: { ...type.bodyStrong, color: t.text },
  itemMeta: { ...type.caption, color: t.textMuted },
  itemAmount: { width: 104 },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: t.primarySoft,
  },
  addButtonDone: { backgroundColor: t.surfaceSunken },
  addButtonText: { ...type.label, color: t.primary },
  addButtonTextDone: { color: t.textFaint },
  manualToggle: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  manualToggleText: { ...type.label, color: t.primary },
  form: { gap: spacing.md },
  formRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  amount: { flex: 1 },
}));

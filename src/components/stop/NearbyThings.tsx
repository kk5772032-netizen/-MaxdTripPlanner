import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlacesError, hasApiKey, nearbyRestaurants, photoUrl } from '../../api/places';
import { openState } from '../../places/hours';
import { elevation, makeStyles, radius, spacing, type, useTheme } from '../../theme';
import type { NearbyRestaurant, Stop } from '../../types';
import { Button, Notice } from '../ui';

/**
 * What else is around this stop.
 *
 * Deliberately behind a tap rather than loaded with the screen. Nearby Search
 * is the most expensive call this app makes, and "what else is here" is a
 * question people ask once while planning a day, not every time they open a
 * stop. The button says what it is going to do; the result is cached for a
 * month afterwards.
 */
export function NearbyThings({
  stop,
  existingTitles,
  onAdd,
}: {
  stop: Stop;
  /** Lowercased titles already on the list, so nothing is offered twice. */
  existingTitles: Set<string>;
  onAdd: (place: NearbyRestaurant) => void;
}) {
  const styles = useStyles();
  const t = useTheme();

  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [places, setPlaces] = useState<NearbyRestaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canSearch =
    hasApiKey() && !!stop.googlePlaceId && stop.lat != null && stop.lng != null;
  if (!canSearch) return null;

  const load = async (forceRefresh: boolean) => {
    setState('loading');
    setError(null);
    try {
      const result = await nearbyRestaurants(
        stop.googlePlaceId!,
        { lat: stop.lat!, lng: stop.lng! },
        { forceRefresh, kind: 'things' },
      );
      setPlaces(result.restaurants);
      setState('done');
    } catch (e) {
      setError(
        e instanceof PlacesError ? e.message : "Couldn't look up what's nearby.",
      );
      setState('error');
    }
  };

  if (state === 'idle') {
    return (
      <Button
        title="What else is nearby?"
        icon="compass-outline"
        variant="secondary"
        onPress={() => void load(false)}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Nearby</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Look again for nearby places"
          hitSlop={8}
          onPress={() => void load(true)}
        >
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>

      {state === 'loading' ? <Text style={styles.status}>Looking…</Text> : null}
      {error ? <Notice tone="warning" body={error} /> : null}

      {state === 'done' && places.length === 0 ? (
        <Text style={styles.status}>Nothing much around this one.</Text>
      ) : null}

      <View style={styles.list}>
        {places.map((place) => {
          const added = existingTitles.has(place.name.trim().toLowerCase());
          const thumb = photoUrl(place.photoRef, 160);
          const open = openState(place.hours);
          const meta = [
            place.rating != null ? `★ ${place.rating.toFixed(1)}` : null,
            open.status === 'open' ? 'Open now' : open.status === 'closed' ? 'Closed' : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <View key={place.placeId} style={styles.item}>
              {thumb ? (
                <Image
                  source={{ uri: thumb }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="compass-outline" size={18} color={t.textFaint} />
                </View>
              )}

              <View style={styles.itemText}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {place.name}
                </Text>
                {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  added ? `${place.name} is already on your list` : `Add ${place.name}`
                }
                disabled={added}
                onPress={() => onAdd(place)}
                style={[styles.add, added && styles.addDone]}
              >
                <Text style={[styles.addText, added && styles.addTextDone]}>
                  {added ? 'Added' : 'Add'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...type.label, color: t.textMuted },
  refresh: { ...type.label, color: t.primary },
  status: { ...type.caption, color: t.textFaint },

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
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: t.surfaceSunken },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, gap: 1 },
  itemTitle: { ...type.body, color: t.text },
  itemMeta: { ...type.caption, color: t.textMuted },

  add: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: t.primarySoft,
  },
  addDone: { backgroundColor: 'transparent' },
  addText: { ...type.label, color: t.primary },
  addTextDone: { color: t.textFaint },
}));

import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { colors, radius, spacing } from '../theme';
import type { Stop } from '../types';

/**
 * The itinerary as a map: a numbered marker per stop in sequence order, a line
 * connecting them, and a tap-through to each stop's detail.
 *
 * Stops added by hand have no coordinates, so they can't be drawn. Rather than
 * silently dropping them the map says how many are missing.
 */
export function MapWithRoute({
  stops,
  onPressStop,
  style,
}: {
  stops: Stop[];
  onPressStop: (stop: Stop) => void;
  style?: ViewStyle;
}) {
  const located = useMemo(
    () =>
      stops
        .filter((s): s is Stop & { lat: number; lng: number } => s.lat != null && s.lng != null)
        .sort((a, b) => a.sequence - b.sequence),
    [stops],
  );

  const missing = stops.length - located.length;

  // A region that fits every stop, with a margin so markers aren't on the edge.
  const region = useMemo<Region | undefined>(() => {
    if (located.length === 0) return undefined;

    const lats = located.map((s) => s.lat);
    const lngs = located.map((s) => s.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      // A single stop has zero span, so fall back to a ~2km window.
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
    };
  }, [located]);

  if (located.length === 0) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderTitle}>Nothing to map yet</Text>
        <Text style={styles.placeholderBody}>
          {stops.length === 0
            ? 'Add a stop to see it here.'
            : 'These stops were added by hand, so they have no coordinates. Add stops via search to place them on the map.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        // Google on Android; Apple Maps on iOS, which needs no key of its own.
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
      >
        <Polyline
          coordinates={located.map((s) => ({ latitude: s.lat, longitude: s.lng }))}
          strokeColor={colors.primary}
          strokeWidth={3}
          lineDashPattern={[8, 6]}
        />

        {located.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={stop.name}
            description={stop.address ?? undefined}
            onCalloutPress={() => onPressStop(stop)}
          >
            <View style={styles.pin}>
              <Text style={styles.pinText}>{index + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {missing > 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {missing} {missing === 1 ? 'stop has' : 'stops have'} no location and
            {missing === 1 ? " isn't" : " aren't"} shown.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.border, overflow: 'hidden' },
  placeholder: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placeholderTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  placeholderBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notice: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: { fontSize: 12, color: colors.textMuted },
});

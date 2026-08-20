import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing } from '../theme';
import type { Stop } from '../types';

/**
 * Web stand-in for the map.
 *
 * `react-native-maps` is native-only — importing it on web throws at module
 * load and takes the whole trip detail screen with it. Metro picks this file
 * for web and the native one everywhere else, so the native map is never
 * bundled for the browser.
 *
 * Rather than an apology, this lists the stops in order with their
 * coordinates, which is the information the map was carrying.
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
  const styles = useStyles();
  const located = stops
    .filter((s): s is Stop & { lat: number; lng: number } => s.lat != null && s.lng != null)
    .sort((a, b) => a.sequence - b.sequence);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>Map view is available in the mobile app</Text>
      <Text style={styles.body}>
        The route map uses native map views, which don&apos;t run in a browser. The
        itinerary below is the same sequence the map would draw.
      </Text>

      {located.length === 0 ? (
        <Text style={styles.empty}>
          {stops.length === 0
            ? 'No stops yet.'
            : 'These stops were added by hand, so they have no coordinates.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {located.map((stop, index) => (
            <Text
              key={stop.id}
              accessibilityRole="button"
              onPress={() => onPressStop(stop)}
              style={styles.row}
            >
              {index + 1}. {stop.name}
              <Text style={styles.coords}>
                {'  '}
                {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
              </Text>
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '600', color: t.text },
  body: { fontSize: 13, color: t.textMuted, lineHeight: 19 },
  empty: { fontSize: 13, color: t.textFaint, marginTop: spacing.sm },
  list: { marginTop: spacing.sm, gap: spacing.sm },
  row: { fontSize: 14, color: t.text },
  coords: { fontSize: 12, color: t.textFaint },
}));

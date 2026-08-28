import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';

import { currencySymbol } from '../../budget/money';
import { formatTime } from '../../itinerary/schedule';
import { openState, priceLevelLabel, todayHours } from '../../places/hours';
import { HIT_SLOP, MIN_TAP, makeStyles, radius, spacing, type, useTheme } from '../../theme';
import type { PlaceDetails } from '../../types';

/**
 * What Google knows about a place, in the order someone standing outside it
 * would want: is it open, is it any good, what does it cost, where is it, and
 * how do I reach it.
 *
 * Every row is conditional. A place with no hours simply has no hours line —
 * there are no "not available" placeholders, because a screen full of those
 * reads as broken rather than as sparse.
 */
export function PlaceFacts({
  details,
  currency,
  /** Recomputed each render in real use; injectable so tests can fix the clock. */
  now,
}: {
  details: PlaceDetails;
  currency: string;
  now?: Date;
}) {
  const styles = useStyles();
  const t = useTheme();

  const state = openState(details.hours, now);
  const today = todayHours(details.hours, now);
  const price = priceLevelLabel(details.priceLevel, currencySymbol(currency));

  return (
    <View style={styles.wrap}>
      {state.status !== 'unknown' ? (
        <View style={styles.hoursRow}>
          <View
            style={[styles.pill, state.status === 'open' ? styles.pillOpen : styles.pillShut]}
          >
            <Text
              style={[
                styles.pillText,
                state.status === 'open' ? styles.pillTextOpen : styles.pillTextShut,
              ]}
            >
              {state.status === 'open' ? 'Open now' : 'Closed'}
            </Text>
          </View>
          <Text style={styles.hoursText} numberOfLines={1}>
            {nextChange(state)}
            {today ? ` · ${today}` : ''}
          </Text>
        </View>
      ) : null}

      {details.rating !== null || price ? (
        <View style={styles.factRow}>
          {details.rating !== null ? (
            <>
              <Ionicons name="star" size={15} color={t.near} />
              <Text style={styles.factShrink}>
                {details.rating.toFixed(1)}
                {details.userRatingCount
                  ? ` · ${formatCount(details.userRatingCount)} reviews`
                  : ''}
              </Text>
            </>
          ) : null}
          {details.rating !== null && price ? <Text style={styles.dot}>·</Text> : null}
          {price ? <Text style={styles.factShrink}>{price}</Text> : null}
        </View>
      ) : null}

      {details.address ? (
        <View style={styles.factRow}>
          <Ionicons name="location-outline" size={15} color={t.textMuted} />
          <Text style={styles.fact}>{details.address}</Text>
        </View>
      ) : null}

      {details.phone || details.website ? (
        <View style={styles.links}>
          {details.phone ? (
            <LinkButton
              icon="call-outline"
              label={details.phone}
              url={`tel:${details.phone.replace(/\s+/g, '')}`}
            />
          ) : null}
          {details.website ? (
            <LinkButton icon="globe-outline" label="Website" url={details.website} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** "Closes 9:00 pm" / "Opens 9:00 am" — the bit of the hours you act on. */
function nextChange(state: ReturnType<typeof openState>): string {
  if (state.status === 'open') {
    return state.until ? `Closes ${formatTime(state.until)}` : 'Open 24 hours';
  }
  if (state.status === 'closed') {
    return state.opensAt ? `Opens ${formatTime(state.opensAt)}` : 'Closed';
  }
  return '';
}

/** 1284 -> "1.3k". Four digits of review count is noise, not information. */
function formatCount(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
}

function LinkButton({ icon, label, url }: { icon: 'call-outline' | 'globe-outline'; label: string; url: string }) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
      // Failing to open is silent by design: nothing useful can be said about
      // a device with no dialler or browser that the user doesn't already know.
      onPress={() => void Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={15} color={t.primary} />
      <Text style={styles.linkText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: spacing.sm },

  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pillOpen: { backgroundColor: t.underSoft },
  pillShut: { backgroundColor: t.surfaceSunken },
  pillText: { ...type.captionStrong },
  pillTextOpen: { color: t.underText },
  pillTextShut: { color: t.textMuted },
  hoursText: { flex: 1, ...type.caption, color: t.textMuted },

  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fact: { flex: 1, ...type.body, color: t.text },
  factShrink: { flexShrink: 1, ...type.body, color: t.text },
  dot: { ...type.body, color: t.textFaint },

  links: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TAP,
    paddingRight: spacing.sm,
  },
  linkText: { ...type.label, color: t.primary },

  pressed: { opacity: 0.6 },
}));

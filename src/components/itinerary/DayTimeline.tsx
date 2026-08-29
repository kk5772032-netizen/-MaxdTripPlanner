import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { photoUrl } from '../../api/places';
import { directionsUrl, openInMaps } from '../../places/maps';
import {
  dayEntries,
  formatDayLabel,
  formatDuration,
  formatSpan,
  formatTime,
  planByDay,
  plannedMinutes,
} from '../../itinerary/schedule';
import {
  bookingIcons,
  bookingLabels,
  elevation,
  makeStyles,
  radius,
  spacing,
  type,
  useTheme,
} from '../../theme';
import type { Activity, Booking, FoodPlan, Stop, Trip } from '../../types';
import type { IconName } from '../ui';

/**
 * The itinerary as a plan rather than a list.
 *
 * The old view was a flat run of stop cards, which answered "where am I going?"
 * but not "what am I doing on Tuesday?" — the question people actually open an
 * itinerary to ask. Days are the spine here: every day of the trip appears,
 * including the empty ones, because an empty Tuesday is information and it is
 * where the invitation to plan something belongs.
 *
 * Order within a day comes from the clock, not from dragging. A stop with no
 * time is "sometime today" and sits below the timed ones.
 */
export function DayTimeline({
  trip,
  stops,
  activities,
  foodPlans,
  bookings,
  onPressStop,
  onPressBooking,
  onAddStop,
}: {
  trip: Trip;
  stops: Stop[];
  activities: Activity[];
  foodPlans: FoodPlan[];
  bookings: Booking[];
  onPressStop: (stop: Stop) => void;
  onPressBooking: (booking: Booking) => void;
  onAddStop: (dayDate: string | null) => void;
}) {
  const styles = useStyles();
  const days = planByDay(trip, stops, bookings);
  if (days.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {days.map((day) => (
        <DaySection
          key={day.date ?? 'unscheduled'}
          day={day}
          activities={activities}
          foodPlans={foodPlans}
          onPressStop={onPressStop}
          onPressBooking={onPressBooking}
          onAddStop={onAddStop}
        />
      ))}
    </View>
  );
}

function DaySection({
  day,
  activities,
  foodPlans,
  onPressStop,
  onPressBooking,
  onAddStop,
}: {
  day: ReturnType<typeof planByDay>[number];
  activities: Activity[];
  foodPlans: FoodPlan[];
  onPressStop: (stop: Stop) => void;
  onPressBooking: (booking: Booking) => void;
  onAddStop: (dayDate: string | null) => void;
}) {
  const styles = useStyles();
  const t = useTheme();

  const ids = new Set(day.stops.map((s) => s.id));
  const dayActivities = activities.filter((a) => ids.has(a.stopId));
  const planned = formatDuration(plannedMinutes(dayActivities));

  const entries = dayEntries(day);
  const unscheduled = day.date === null;
  const summary = unscheduled
    ? `${day.stops.length} ${day.stops.length === 1 ? 'place' : 'places'} with no day yet`
    : [
        day.stops.length
          ? `${day.stops.length} ${day.stops.length === 1 ? 'stop' : 'stops'}`
          : null,
        day.bookings.length
          ? `${day.bookings.length} booked`
          : null,
        planned ? `about ${planned} planned` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  // A day outside the trip's own dates — the flight home the morning after —
  // has no day number, so it is titled by its date instead of "Day —".
  const title = unscheduled
    ? 'Not scheduled yet'
    : day.dayNumber === null
      ? formatDayLabel(day.date!)
      : `Day ${day.dayNumber}`;
  const subtitle = unscheduled
    ? summary
    : day.dayNumber === null
      ? ['Outside the trip dates', summary].filter(Boolean).join(' · ')
      : `${formatDayLabel(day.date!)}${summary ? ` · ${summary}` : ''}`;

  return (
    <View style={styles.section}>
      <View style={styles.dayHead}>
        <View style={styles.dayHeadText}>
          <Text style={styles.dayTitle}>{title}</Text>
          <Text style={styles.daySub}>{subtitle}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unscheduled ? 'Add a place' : `Add to ${formatDayLabel(day.date!)}`
          }
          hitSlop={8}
          onPress={() => onAddStop(day.date)}
          style={({ pressed }) => [styles.dayAdd, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={18} color={t.primary} />
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Nothing planned for ${formatDayLabel(day.date!)}. Add something.`}
          onPress={() => onAddStop(day.date)}
          style={({ pressed }) => [styles.emptyDay, pressed && styles.pressed]}
        >
          <Text style={styles.emptyDayText}>Nothing planned — tap to add something.</Text>
        </Pressable>
      ) : (
        entries.map((entry, i) =>
          entry.kind === 'stop' ? (
            <TimelineRow
              key={`stop-${entry.stop.id}`}
              stop={entry.stop}
              last={i === entries.length - 1}
              activities={activities.filter((a) => a.stopId === entry.stop.id)}
              foodPlans={foodPlans.filter((f) => f.stopId === entry.stop.id)}
              onPress={() => onPressStop(entry.stop)}
            />
          ) : (
            <BookingRow
              key={`booking-${entry.booking.id}-${entry.role}`}
              booking={entry.booking}
              role={entry.role}
              time={entry.time}
              last={i === entries.length - 1}
              onPress={() => onPressBooking(entry.booking)}
            />
          ),
        )
      )}
    </View>
  );
}

function TimelineRow({
  stop,
  last,
  activities,
  foodPlans,
  onPress,
}: {
  stop: Stop;
  last: boolean;
  activities: Activity[];
  foodPlans: FoodPlan[];
  onPress: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const span = formatSpan(stop);
  const done = activities.filter((a) => a.done).length;
  // Straight from the stop's own row — no request, and nothing at all when the
  // place was typed by hand or the build has no Places key.
  const thumb = photoUrl(stop.photoRef, 200);

  const meta = [
    activities.length
      ? `${done}/${activities.length} ${activities.length === 1 ? 'thing' : 'things'} to do`
      : null,
    foodPlans.length
      ? `${foodPlans.length} food ${foodPlans.length === 1 ? 'spot' : 'spots'}`
      : null,
  ].filter(Boolean);

  return (
    <View style={styles.row}>
      {/* The rail: a time, a dot, and a line down to the next stop. */}
      <View style={styles.rail}>
        <Text style={[styles.railTime, !span && styles.railTimeMuted]} numberOfLines={1}>
          {span ? span.split(' – ')[0] : '—'}
        </Text>
        <View style={styles.dot} />
        {!last ? <View style={styles.line} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${stop.name}${span ? `, ${span}` : ''}`}
        onPress={onPress}
        style={({ pressed }) => [styles.card, elevation.sm, pressed && styles.pressed]}
      >
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.thumb}
            contentFit="cover"
            transition={150}
          />
        ) : null}

        <View style={styles.cardText}>
          <View style={styles.cardTop}>
            <Text style={styles.stopName} numberOfLines={1}>
              {stop.name}
            </Text>
            {stop.rating != null ? (
              <View style={styles.rating}>
                <Ionicons name="star" size={11} color={t.near} />
                <Text style={styles.ratingText}>{stop.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          {stop.address ? (
            <Text style={styles.address} numberOfLines={1}>
              {stop.address}
            </Text>
          ) : null}

          {span && stop.endTime ? <Text style={styles.span}>{span}</Text> : null}

          {meta.length > 0 ? <Text style={styles.meta}>{meta.join(' · ')}</Text> : null}
        </View>

        {/* The one thing worth doing from the plan without opening the stop:
            you are standing somewhere and you need to get to the next place. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${stop.name} in Google Maps`}
          hitSlop={8}
          onPress={() => void openInMaps(directionsUrl(stop))}
          style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
        >
          <Ionicons name="navigate" size={16} color={t.primary} />
        </Pressable>
      </Pressable>
    </View>
  );
}

/**
 * A booking on the plan.
 *
 * Deliberately not a stop card: no photo, a tinted ground and the kind spelled
 * out, because at a glance you need to know this is a thing you have already
 * paid for rather than somewhere you are thinking of going. The confirmation
 * code is on the row for the same reason it is in the Booked section — that is
 * the number someone asks you for.
 */
function BookingRow({
  booking,
  role,
  time,
  last,
  onPress,
}: {
  booking: Booking;
  role: 'start' | 'checkout';
  time: string | null;
  last: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();

  const checkout = role === 'checkout';
  const label = checkout ? 'Check out' : bookingLabels[booking.kind];
  const meta = [booking.confirmation, checkout ? null : booking.location]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <Text style={[styles.railTime, !time && styles.railTimeMuted]} numberOfLines={1}>
          {time ? formatTime(time) : '—'}
        </Text>
        {/* A square marker rather than the stops' round dot: the rail then reads
            as two kinds of thing without needing a legend. */}
        <View style={styles.square} />
        {!last ? <View style={styles.line} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${booking.title}${time ? `, ${formatTime(time)}` : ''}`}
        onPress={onPress}
        style={({ pressed }) => [styles.bookingCard, pressed && styles.pressed]}
      >
        <Ionicons
          name={(checkout ? 'exit-outline' : bookingIcons[booking.kind]) as IconName}
          size={17}
          color={t.primary}
          style={styles.bookingIcon}
        />

        <View style={styles.cardText}>
          <Text style={styles.bookingKind}>{label}</Text>
          <Text style={styles.bookingTitle} numberOfLines={1}>
            {booking.title}
          </Text>
          {meta ? (
            <Text style={styles.bookingMeta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: spacing.xl },
  section: { gap: spacing.sm },

  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dayHeadText: { flex: 1, gap: 1 },
  dayTitle: { ...type.heading, color: t.text },
  daySub: { ...type.caption, color: t.textMuted },
  dayAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyDay: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyDayText: { ...type.caption, color: t.textFaint },

  row: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 62, alignItems: 'center', paddingTop: 2 },
  railTime: {
    ...type.caption,
    fontWeight: '600',
    color: t.text,
    fontVariant: ['tabular-nums'],
  },
  railTimeMuted: { color: t.textFaint, fontWeight: '400' },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: t.primary,
    marginTop: 5,
  },
  square: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: t.primary,
    marginTop: 5,
  },
  // Reaches past the card's bottom margin so the rail reads as continuous.
  line: { flex: 1, width: 2, backgroundColor: t.border, marginTop: 2, marginBottom: -spacing.sm },

  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardText: { flex: 1, gap: 2 },

  bookingCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: t.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  bookingIcon: { width: 20, textAlign: 'center' },
  bookingKind: { ...type.captionStrong, color: t.primary },
  bookingTitle: { ...type.bodyStrong, color: t.text },
  bookingMeta: { ...type.caption, color: t.textMuted },
  directions: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: t.surfaceSunken },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stopName: { ...type.bodyStrong, color: t.text, flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { ...type.caption, fontWeight: '600', color: t.textMuted },
  address: { ...type.caption, color: t.textMuted },
  span: { ...type.caption, color: t.textMuted, fontVariant: ['tabular-nums'] },
  meta: { ...type.caption, color: t.textFaint, marginTop: 2 },

  pressed: { opacity: 0.7 },
}));

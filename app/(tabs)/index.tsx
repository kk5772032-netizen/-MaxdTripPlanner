import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDateRange } from '../../src/dates';
import { Checkbox } from '../../src/components/Checkbox';
import { Button, Card, EmptyState, SkeletonList } from '../../src/components/ui';
import { countdown, currentTrip, planForNow, tripPhase } from '../../src/itinerary/now';
import { formatDayLabel, formatTime, type DayEntry } from '../../src/itinerary/schedule';
import { directionsUrl, openInMaps } from '../../src/places/maps';
import { useTripStore } from '../../src/state/tripStore';
import { useTripsStore } from '../../src/state/tripsStore';
import {
  bookingIcons,
  bookingLabels,
  elevation,
  makeStyles,
  radius,
  spacing,
  type,
  useTheme,
} from '../../src/theme';
import type { IconName } from '../../src/components/ui';

/**
 * What is happening now.
 *
 * The plan screen answers "what am I doing on Tuesday?". This answers "what am
 * I doing next?" — the question you have standing in an airport holding a bag,
 * and one the app used to make you open a trip and scroll to find. It is the
 * home tab because during a trip it is the only screen worth opening.
 */
export default function TodayScreen() {
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();

  const trips = useTripsStore((s) => s.trips);
  const loadTrips = useTripsStore((s) => s.load);
  const tripsLoading = useTripsStore((s) => s.loading);

  const { trip, stops, activities, bookings, packing, open } = useTripStore();
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const today = localDate(now);
  const nowTime = localTime(now);

  const target = useMemo(() => currentTrip(trips, today), [trips, today]);

  useFocusEffect(
    useCallback(() => {
      // The clock moves while the app is backgrounded; a screen about "next"
      // that is an hour stale is worse than no screen.
      setNow(new Date());
      void loadTrips();
    }, [loadTrips]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!target) {
        setReady(true);
        return;
      }
      void open(target.id).then(() => setReady(true));
    }, [target, open]),
  );

  if (tripsLoading && trips.length === 0) return <SkeletonList rows={3} />;

  if (!target) {
    return (
      <View style={styles.centre}>
        {/* Deliberately not "No trips yet" — the Trips tab already says that,
            and two screens with the same headline read as one screen that
            failed to navigate. This one says what Today is for. */}
        <EmptyState
          icon="today-outline"
          title="Nothing on right now"
          body="While a trip is running, this is where you'll see what's next — the flight, the reference number, what's still to do."
          action={<Button title="Plan a trip" icon="add" onPress={() => router.push('/new-trip')} />}
        />
      </View>
    );
  }

  const phase = tripPhase(target, today);
  const loaded = ready && trip?.id === target.id;
  const plan = loaded ? planForNow(target, stops, bookings, activities, today, nowTime) : null;

  const packed = packing.filter((i) => i.packed).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${target.name}`}
        onPress={() => router.push(`/trip/${target.id}`)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Text style={styles.tripName}>{target.name}</Text>
        <Text style={styles.tripWhen}>
          {phase.kind === 'running'
            ? `Day ${phase.dayNumber} of ${phase.of} · ${formatDayLabel(today)}`
            : phase.kind === 'upcoming'
              ? `Starts ${countdown(phase.daysAway)} · ${formatDateRange(target.startDate, target.endDate)}`
              : phase.kind === 'past'
                ? formatDateRange(target.startDate, target.endDate)
                : 'No dates yet'}
        </Text>
      </Pressable>

      {!loaded ? <SkeletonList rows={2} /> : null}

      {plan?.next ? (
        <NextCard entry={plan.next} onOpenStop={(id) => router.push(`/trip/${target.id}/place/${id}`)} />
      ) : null}

      {plan && plan.later.length > 0 ? (
        <Section title={plan.next ? 'After that' : 'Still today'}>
          {plan.later.map((entry) => (
            <Row key={keyOf(entry)} entry={entry} onOpenStop={(id) => router.push(`/trip/${target.id}/place/${id}`)} />
          ))}
        </Section>
      ) : null}

      {plan && plan.todo.length > 0 ? (
        <Section title={`${plan.todo.length} still to do`}>
          {plan.todo.slice(0, 6).map((a) => (
            <Todo key={a.id} title={a.title} stopId={a.stopId}
              onPress={() => router.push(`/trip/${target.id}/place/${a.stopId}`)} />
          ))}
        </Section>
      ) : null}

      {plan && !plan.next && plan.later.length === 0 && plan.earlier.length > 0 ? (
        <Card style={styles.doneCard}>
          <Ionicons name="moon-outline" size={20} color={t.textMuted} />
          <Text style={styles.doneText}>That's the day. Nothing else scheduled.</Text>
        </Card>
      ) : null}

      {loaded && phase.kind === 'running' && !plan ? (
        <Card style={styles.doneCard}>
          <Text style={styles.doneText}>Nothing planned for today yet.</Text>
        </Card>
      ) : null}

      {/* Before a trip, the useful thing is not a timeline — it's the bag. */}
      {loaded && phase.kind === 'upcoming' && packing.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Packing: ${packed} of ${packing.length} packed`}
          onPress={() => router.push(`/trip/${target.id}`)}
          style={({ pressed }) => [styles.packing, pressed && styles.pressed]}
        >
          <Ionicons name="briefcase-outline" size={18} color={t.primary} />
          <Text style={styles.packingText}>
            {packed === packing.length
              ? 'Everything is packed'
              : `${packing.length - packed} still to pack`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */

function NextCard({
  entry,
  onOpenStop,
}: {
  entry: DayEntry;
  onOpenStop: (stopId: string) => void;
}) {
  const styles = useStyles();
  const t = useTheme();

  const isStop = entry.kind === 'stop';
  const title = isStop ? entry.stop.name : entry.booking.title;
  const kicker = isStop
    ? 'Next'
    : entry.role === 'checkout'
      ? 'Check out'
      : bookingLabels[entry.booking.kind];
  const detail = isStop
    ? entry.stop.address
    : [entry.booking.confirmation, entry.booking.location].filter(Boolean).join(' · ') || null;

  return (
    <Card style={styles.next}>
      <View style={styles.nextTop}>
        <Text style={styles.nextKicker}>{kicker}</Text>
        {entry.time ? <Text style={styles.nextTime}>{formatTime(entry.time)}</Text> : null}
      </View>

      <Text style={styles.nextTitle}>{title}</Text>
      {detail ? (
        <Text style={styles.nextDetail} selectable={!isStop}>
          {detail}
        </Text>
      ) : null}

      <View style={styles.nextActions}>
        {isStop ? (
          <>
            <View style={styles.grow}>
              <Button
                title="Directions"
                icon="navigate"
                onPress={() => void openInMaps(directionsUrl(entry.stop))}
              />
            </View>
            <View style={styles.grow}>
              <Button
                title="Open"
                icon="chevron-forward"
                variant="secondary"
                onPress={() => onOpenStop(entry.stop.id)}
              />
            </View>
          </>
        ) : (
          <View style={styles.kindTile}>
            <Ionicons
              name={bookingIcons[entry.booking.kind] as IconName}
              size={18}
              color={t.primary}
            />
          </View>
        )}
      </View>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function Row({
  entry,
  onOpenStop,
}: {
  entry: DayEntry;
  onOpenStop: (stopId: string) => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const isStop = entry.kind === 'stop';
  const title = isStop ? entry.stop.name : entry.booking.title;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${entry.time ? `, ${formatTime(entry.time)}` : ''}`}
      onPress={() => (isStop ? onOpenStop(entry.stop.id) : undefined)}
      disabled={!isStop}
      style={({ pressed }) => [styles.row, pressed && isStop && styles.rowPressed]}
    >
      <Text style={[styles.rowTime, !entry.time && styles.rowTimeMuted]}>
        {entry.time ? formatTime(entry.time) : '—'}
      </Text>
      {!isStop ? (
        <Ionicons
          name={bookingIcons[entry.booking.kind] as IconName}
          size={15}
          color={t.primary}
        />
      ) : null}
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

function Todo({
  title,
  stopId,
  onPress,
}: {
  title: string;
  stopId: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Checkbox checked={false} />
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */

/** A hotel appears twice on its day, so the role has to be part of the key. */
function keyOf(entry: DayEntry): string {
  return entry.kind === 'stop'
    ? `stop-${entry.stop.id}`
    : `booking-${entry.booking.id}-${entry.role}`;
}

/** Local, not UTC: "today" is the day you are standing in. */
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function localTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  centre: { flex: 1, justifyContent: 'center' },

  header: { gap: 2 },
  tripName: { ...type.hero, color: t.text },
  tripWhen: { ...type.body, color: t.textMuted },

  next: { gap: spacing.xs },
  nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextKicker: { ...type.captionStrong, color: t.primary, textTransform: 'uppercase' },
  nextTime: { ...type.heading, color: t.text, fontVariant: ['tabular-nums'] },
  nextTitle: { ...type.title, color: t.text },
  nextDetail: { ...type.body, color: t.textMuted },
  nextActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  grow: { flex: 1 },
  kindTile: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.primarySoft,
  },

  section: { gap: spacing.sm },
  sectionTitle: { ...type.label, color: t.textMuted },
  list: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    overflow: 'hidden',
    ...elevation.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  rowPressed: { backgroundColor: t.bg },
  rowTime: { ...type.caption, fontWeight: '600', color: t.text, fontVariant: ['tabular-nums'], width: 62 },
  rowTimeMuted: { color: t.textFaint, fontWeight: '400' },
  rowTitle: { flex: 1, ...type.body, color: t.text },

  doneCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  doneText: { flex: 1, ...type.body, color: t.textMuted },

  packing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
  },
  packingText: { flex: 1, ...type.body, color: t.text },

  pressed: { opacity: 0.7 },
}));

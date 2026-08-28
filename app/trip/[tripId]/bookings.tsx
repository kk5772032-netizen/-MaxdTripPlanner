import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../../src/budget/money';
import { BookingForm } from '../../../src/components/bookings/BookingForm';
import { EmptyState, HeaderAction, SkeletonList, type IconName } from '../../../src/components/ui';
import { formatDayLabel, formatTime } from '../../../src/itinerary/schedule';
import { useTripStore } from '../../../src/state/tripStore';
import {
  bookingIcons,
  bookingLabels,
  elevation,
  makeStyles,
  radius,
  spacing,
  type,
  useTheme,
} from '../../../src/theme';
import type { Booking } from '../../../src/types';

/**
 * Everything already booked, in the order it happens.
 *
 * This is a lookup screen before it is a planning one: the moment it matters is
 * standing at a desk being asked for a reference number, so the confirmation
 * code is the most prominent thing on a row after the title, and it is
 * selectable rather than something to squint at and retype.
 */
export default function BookingsScreen() {
  const styles = useStyles();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, bookings, loading, open, removeBooking } = useTripStore();

  const [ready, setReady] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);

  useFocusEffect(
    useCallback(() => {
      void open(tripId).then(() => setReady(true));
    }, [tripId, open]),
  );

  // Grouped by the day they start, so a four-day trip reads as four blocks
  // rather than one undifferentiated column.
  const groups = useMemo(() => {
    const byDay = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = b.startsAt ? b.startsAt.slice(0, 10) : '';
      const bucket = byDay.get(key);
      if (bucket) bucket.push(b);
      else byDay.set(key, [b]);
    }
    return [...byDay.entries()].sort(([a], [b]) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return a < b ? -1 : 1;
    });
  }, [bookings]);

  if (loading || !ready) return <SkeletonList rows={3} />;
  if (!trip) return null;

  const close = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Bookings',
          headerRight: () => (
            <HeaderAction
              label={formOpen || editing ? 'Close' : 'Add'}
              icon={formOpen || editing ? 'close' : 'add'}
              onPress={() => {
                if (formOpen || editing) close();
                else setFormOpen(true);
              }}
            />
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {formOpen || editing ? (
          <BookingForm
            key={editing?.id ?? 'new'}
            currency={trip.currency}
            trip={trip}
            editing={editing}
            onDone={close}
          />
        ) : null}

        {bookings.length === 0 && !formOpen ? (
          <EmptyState
            icon="bookmark-outline"
            title="Nothing booked yet"
            body="Flights, hotels, trains and tables — with their confirmation numbers, so you're not digging through email at a check-in desk."
          />
        ) : null}

        {groups.map(([day, items]) => (
          <View key={day || 'undated'} style={styles.group}>
            <Text style={styles.groupTitle}>
              {day ? formatDayLabel(day) : 'No date yet'}
            </Text>
            <View style={styles.list}>
              {items.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  currency={trip.currency}
                  onPress={() => {
                    setFormOpen(false);
                    setEditing(booking);
                  }}
                  onLongPress={() => void removeBooking(booking.id)}
                />
              ))}
            </View>
          </View>
        ))}

        {bookings.length > 0 ? (
          <Text style={styles.hint}>Tap to edit, long-press to delete.</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BookingRow({
  booking,
  currency,
  onPress,
  onLongPress,
}: {
  booking: Booking;
  currency: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();

  const time = booking.startsAt ? formatTime(booking.startsAt.slice(11, 16)) : null;
  const endTime = booking.endsAt ? formatTime(booking.endsAt.slice(11, 16)) : null;
  const when = time ? (endTime ? `${time} – ${endTime}` : time) : null;

  const meta = [when, booking.location].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${bookingLabels[booking.kind]}: ${booking.title}${
        booking.confirmation ? `, reference ${booking.confirmation}` : ''
      }`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.kindTile}>
        <Ionicons
          name={bookingIcons[booking.kind] as IconName}
          size={18}
          color={t.primary}
        />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {booking.title}
        </Text>
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {booking.confirmation ? (
          // Selectable: this is the number someone reads aloud at a counter.
          <Text style={styles.confirmation} selectable numberOfLines={1}>
            {booking.confirmation}
          </Text>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        {booking.costMinor !== null ? (
          <Text style={styles.cost}>
            {formatMoney(booking.costMinor, currency, { compact: true })}
          </Text>
        ) : null}
        {booking.attachmentName ? (
          <Ionicons name="document-attach-outline" size={15} color={t.textFaint} />
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, backgroundColor: t.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  group: { gap: spacing.sm },
  groupTitle: { ...type.label, color: t.textMuted },

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
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  rowPressed: { backgroundColor: t.bg },
  kindTile: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { ...type.bodyStrong, color: t.text },
  rowMeta: { ...type.caption, color: t.textMuted },
  confirmation: {
    ...type.caption,
    fontWeight: '600',
    color: t.text,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  cost: { ...type.label, color: t.text, fontVariant: ['tabular-nums'] },

  hint: { ...type.caption, color: t.textFaint, textAlign: 'center' },
}));

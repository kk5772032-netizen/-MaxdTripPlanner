import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { parseMoney, toDecimalString } from '../../budget/money';
import { attachDocument, type Attachment } from '../../documents';
import { tripDays } from '../../itinerary/schedule';
import { useTripStore } from '../../state/tripStore';
import { HIT_SLOP, bookingIcons, bookingLabels, makeStyles, spacing, type, useTheme } from '../../theme';
import { BOOKING_KINDS, type Booking, type BookingKind, type Trip } from '../../types';
import { AmountInput } from '../AmountInput';
import { DateTimeField } from '../DateTimeField';
import { Button, Card, Field, Input, notifySuccess, type IconName } from '../ui';

/**
 * Add or edit a booking.
 *
 * Only the title is required. Every other field is something you might not
 * know yet — a hotel booked before the flight, a train with no reference until
 * the morning — and refusing to save until they're filled is how this ends up
 * in someone's notes app instead.
 */
export function BookingForm({
  currency,
  trip,
  editing,
  onDone,
}: {
  currency: string;
  trip: Trip;
  editing: Booking | null;
  onDone: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const { addBooking, updateBooking, removeBooking } = useTripStore();

  const [kind, setKind] = useState<BookingKind>(editing?.kind ?? 'flight');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [confirmation, setConfirmation] = useState(editing?.confirmation ?? '');
  const [startsAt, setStartsAt] = useState<string | null>(editing?.startsAt ?? null);
  const [endsAt, setEndsAt] = useState<string | null>(editing?.endsAt ?? null);
  const [location, setLocation] = useState(editing?.location ?? '');
  const [costText, setCostText] = useState(
    editing?.costMinor != null ? toDecimalString(editing.costMinor, currency) : '',
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [attachment, setAttachment] = useState<Attachment | null>(
    editing?.attachmentUri && editing.attachmentName
      ? { uri: editing.attachmentUri, name: editing.attachmentName }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const days = tripDays(trip);
  const canSave = title.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const fields = {
        kind,
        title: title.trim(),
        confirmation: confirmation.trim() || null,
        startsAt,
        endsAt,
        location: location.trim() || null,
        costMinor: parseMoney(costText, currency),
        notes: notes.trim() || null,
        attachmentUri: attachment?.uri ?? null,
        attachmentName: attachment?.name ?? null,
      };
      if (editing) await updateBooking(editing.id, fields);
      else await addBooking(fields);
      notifySuccess();
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const pickDocument = async () => {
    setAttachError(null);
    const result = await attachDocument();
    if (result.ok) setAttachment(result.attachment);
    else if (result.reason) setAttachError(result.reason);
  };

  return (
    <Card style={styles.card}>
      <Field label={editing ? 'Booking' : 'New booking'}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kinds}
        >
          {BOOKING_KINDS.map((option) => {
            const active = option === kind;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={bookingLabels[option]}
                onPress={() => setKind(option)}
                style={({ pressed }) => [
                  styles.kind,
                  active && styles.kindOn,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={bookingIcons[option] as IconName}
                  size={15}
                  color={active ? t.primary : t.textMuted}
                />
                <Text style={[styles.kindText, active && styles.kindTextOn]}>
                  {bookingLabels[option]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Field>

      <Field label="What is it">
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={PLACEHOLDERS[kind]}
          autoFocus={!editing}
          accessibilityLabel="Booking title"
        />
      </Field>

      <Field
        label="Confirmation"
        hint="The reference you'll be asked for. Optional — add it when you have it."
      >
        <Input
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="PNR7Y2Q"
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Confirmation number"
        />
      </Field>

      <Field label="Starts">
        <DateTimeField value={startsAt} days={days} onChange={setStartsAt} label="Start" />
      </Field>

      {startsAt ? (
        <Field label="Ends">
          <DateTimeField value={endsAt} days={days} onChange={setEndsAt} label="End" />
        </Field>
      ) : null}

      <Field label="Where">
        <Input
          value={location}
          onChangeText={setLocation}
          placeholder={LOCATION_PLACEHOLDERS[kind]}
          accessibilityLabel="Location"
        />
      </Field>

      <Field label="Cost" hint="Optional. Bookings aren't expenses until you log them.">
        <AmountInput
          value={costText}
          onChangeText={setCostText}
          currency={currency}
          placeholder="0"
          accessibilityLabel="Cost"
        />
      </Field>

      <Field label="Ticket or voucher">
        {attachment ? (
          <View style={styles.attachment}>
            <Ionicons name="document-text-outline" size={18} color={t.primary} />
            <Text style={styles.attachmentName} numberOfLines={1}>
              {attachment.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove the attached file"
              hitSlop={HIT_SLOP}
              onPress={() => setAttachment(null)}
            >
              <Ionicons name="close" size={18} color={t.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Button
            title="Attach a file"
            icon="attach-outline"
            variant="secondary"
            onPress={() => void pickDocument()}
          />
        )}
        {attachError ? <Text style={styles.attachError}>{attachError}</Text> : null}
      </Field>

      <Field label="Notes">
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Window seat booked"
          multiline
          style={styles.notes}
          accessibilityLabel="Notes"
        />
      </Field>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title={editing ? 'Save booking' : 'Add booking'}
            icon="checkmark"
            onPress={() => void save()}
            disabled={!canSave}
            loading={saving}
          />
        </View>
        <View style={styles.action}>
          <Button title="Cancel" variant="secondary" onPress={onDone} />
        </View>
      </View>

      {editing ? (
        <Button
          title="Delete booking"
          icon="trash-outline"
          variant="danger"
          onPress={() => {
            void removeBooking(editing.id);
            onDone();
          }}
        />
      ) : null}
    </Card>
  );
}

/** Concrete enough to show the shape of a good title without dictating one. */
const PLACEHOLDERS: Record<BookingKind, string> = {
  flight: 'DEL → BOM, AI 665',
  lodging: 'Hotel Broadway, 2 nights',
  train: 'Shatabdi Express',
  bus: 'Overnight to Manali',
  car: 'Airport pickup',
  restaurant: "Karim's, table for 4",
  other: 'Museum tickets',
};

const LOCATION_PLACEHOLDERS: Record<BookingKind, string> = {
  flight: 'Terminal 3',
  lodging: '23 Asaf Ali Road',
  train: 'New Delhi station',
  bus: 'ISBT Kashmere Gate',
  car: 'Arrivals, gate 4',
  restaurant: 'Jama Masjid',
  other: '',
};

const useStyles = makeStyles((t) => ({
  card: { gap: spacing.md },
  kinds: { gap: spacing.sm, paddingRight: spacing.md },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  kindOn: { borderColor: t.primary, backgroundColor: t.primarySoft },
  kindText: { ...type.label, color: t.textMuted },
  kindTextOn: { color: t.primary },

  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: t.surfaceSunken,
  },
  attachmentName: { flex: 1, ...type.body, color: t.text },
  attachError: { ...type.caption, color: t.overText, marginTop: spacing.xs },

  notes: { minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.md },

  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },

  pressed: { opacity: 0.7 },
}));

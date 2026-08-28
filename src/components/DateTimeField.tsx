import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDayLabel, formatTime } from '../itinerary/schedule';
import { HIT_SLOP, MIN_TAP, makeStyles, radius, spacing, type, useTheme } from '../theme';

/**
 * A day and a time, stored together as `YYYY-MM-DDTHH:MM`.
 *
 * Bookings usually fall on a day of the trip, so those are offered as chips —
 * one tap instead of a calendar. Anything outside the trip (a flight home the
 * morning after) can still be typed, because refusing dates outside the range
 * would make the field useless for exactly the bookings that bracket a trip.
 */
export function DateTimeField({
  value,
  days,
  onChange,
  label,
}: {
  value: string | null;
  days: string[];
  onChange: (value: string | null) => void;
  label: string;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [pickingTime, setPickingTime] = useState(false);

  const date = value ? value.slice(0, 10) : null;
  const time = value ? value.slice(11, 16) : null;

  const setDate = (next: string | null) => {
    if (!next) return onChange(null);
    // Date alone when no time has been chosen. Defaulting to 09:00 would put a
    // time on the screen that nobody entered, and a flight that claims to
    // leave at nine when it leaves at six is worse than one with no time.
    onChange(time ? `${next}T${time}` : next);
  };

  const setTime = (next: string) => {
    // A time needs a day to belong to; default to the trip's first.
    onChange(`${date ?? days[0] ?? new Date().toISOString().slice(0, 10)}T${next}`);
  };

  return (
    <View style={styles.wrap}>
      {days.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {days.map((day, i) => {
            const active = date === day;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${label} on day ${i + 1}, ${formatDayLabel(day)}`}
                onPress={() => setDate(active ? null : day)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextOn]}>
                  {formatDayLabel(day)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <TextInput
          accessibilityLabel={`${label} date, as year dash month dash day`}
          value={date ?? ''}
          onChangeText={(text) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(text)) setDate(text);
            else if (text === '') onChange(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={t.textFaint}
          style={styles.dateInput}
        />
      )}

      <View style={styles.timeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} time: ${formatTime(time) ?? 'not set'}`}
          onPress={() => setPickingTime((o) => !o)}
          style={({ pressed }) => [
            styles.time,
            pickingTime && styles.timeActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="time-outline" size={16} color={t.textMuted} />
          <Text style={[styles.timeText, !time && styles.timeEmpty]}>
            {formatTime(time) ?? 'Add a time'}
          </Text>
        </Pressable>

        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear the ${label.toLowerCase()}`}
            hitSlop={HIT_SLOP}
            onPress={() => {
              setPickingTime(false);
              onChange(null);
            }}
            style={styles.clear}
          >
            <Ionicons name="close" size={16} color={t.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {pickingTime ? (
        Platform.OS === 'web' ? (
          <TextInput
            accessibilityLabel={`${label} time, as hours colon minutes`}
            autoFocus
            defaultValue={time ?? ''}
            onChangeText={(text) => {
              if (/^\d{2}:\d{2}$/.test(text)) setTime(text);
            }}
            placeholder="HH:MM"
            placeholderTextColor={t.textFaint}
            style={styles.dateInput}
          />
        ) : (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={toDate(time)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, picked) => {
                if (Platform.OS !== 'ios') setPickingTime(false);
                if (!picked) return;
                setTime(
                  `${String(picked.getHours()).padStart(2, '0')}:${String(
                    picked.getMinutes(),
                  ).padStart(2, '0')}`,
                );
              }}
            />
          </View>
        )
      ) : null}
    </View>
  );
}

function toDate(hhmm: string | null): Date {
  const d = new Date();
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  d.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0);
  return d;
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: spacing.sm },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    minHeight: MIN_TAP,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  chipOn: { borderColor: t.primary, backgroundColor: t.primarySoft },
  chipText: { ...type.label, color: t.textMuted },
  chipTextOn: { color: t.primary },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  timeActive: { borderColor: t.primary },
  timeText: { ...type.body, color: t.text },
  timeEmpty: { color: t.textFaint },
  clear: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },

  dateInput: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    backgroundColor: t.surface,
    color: t.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  pickerWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: radius.md,
    backgroundColor: t.surface,
    overflow: 'hidden',
  },

  pressed: { opacity: 0.7 },
}));

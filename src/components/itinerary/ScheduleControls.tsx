import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { addMinutes, formatDayLabel, formatTime, tripDays } from '../../itinerary/schedule';
import { HIT_SLOP, MIN_TAP, makeStyles, radius, spacing, type, useTheme } from '../../theme';
import type { Stop, Trip } from '../../types';

/**
 * Putting a stop on a day, and optionally at a time.
 *
 * Deliberately two separate decisions. "Which day" is the one people make first
 * and change often, so it's a row of chips you can hit without a dialog;
 * "what time" is finer work and stays out of the way until the day is settled.
 */
export function ScheduleControls({
  trip,
  stop,
  onChange,
}: {
  trip: Trip;
  stop: Stop;
  onChange: (patch: Partial<Pick<Stop, 'dayDate' | 'startTime' | 'endTime'>>) => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const days = tripDays(trip);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Day</Text>

      {days.length === 0 ? (
        <Text style={styles.noDates}>
          This trip has no dates yet. Set them on the trip to plan by day.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <DayChip
            label="Unscheduled"
            selected={stop.dayDate === null}
            // Clearing the day clears the times too: a 9am with no date is noise.
            onPress={() => onChange({ dayDate: null, startTime: null, endTime: null })}
          />
          {days.map((date, i) => (
            <DayChip
              key={date}
              label={`Day ${i + 1}`}
              sub={formatDayLabel(date)}
              selected={stop.dayDate === date}
              onPress={() => onChange({ dayDate: date })}
            />
          ))}
        </ScrollView>
      )}

      {stop.dayDate ? (
        <>
          <Text style={[styles.label, styles.labelSpaced]}>Time</Text>
          <View style={styles.times}>
            <TimeButton
              caption="Starts"
              value={stop.startTime}
              onPress={() => setPicking(picking === 'start' ? null : 'start')}
              active={picking === 'start'}
            />
            <TimeButton
              caption="Ends"
              value={stop.endTime}
              onPress={() => setPicking(picking === 'end' ? null : 'end')}
              active={picking === 'end'}
              disabled={!stop.startTime}
            />
            {stop.startTime ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear the time"
                hitSlop={HIT_SLOP}
                onPress={() => {
                  setPicking(null);
                  onChange({ startTime: null, endTime: null });
                }}
                style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={16} color={t.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {picking ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={toDate(picking === 'start' ? stop.startTime : stop.endTime)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, picked) => {
                  if (Platform.OS !== 'ios') setPicking(null);
                  if (!picked) return;
                  const hhmm = toHHMM(picked);
                  if (picking === 'start') {
                    // A start with no end gets a sensible hour, so the stop has
                    // a shape on the timeline instead of a single instant.
                    onChange({
                      startTime: hhmm,
                      endTime: stop.endTime ?? addMinutes(hhmm, 60),
                    });
                  } else {
                    onChange({ endTime: hhmm });
                  }
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function DayChip({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipOn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
      {sub ? (
        <Text style={[styles.chipSub, selected && styles.chipTextOn]}>{sub}</Text>
      ) : null}
    </Pressable>
  );
}

function TimeButton({
  caption,
  value,
  onPress,
  active,
  disabled,
}: {
  caption: string;
  value: string | null;
  onPress: () => void;
  active: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${formatTime(value) ?? 'not set'}`}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.time,
        active && styles.timeActive,
        disabled && styles.timeDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.timeCaption}>{caption}</Text>
      <Text style={[styles.timeValue, !value && styles.timeValueEmpty]}>
        {formatTime(value) ?? 'Not set'}
      </Text>
    </Pressable>
  );
}

/** HH:MM to a Date, defaulting to a reasonable hour rather than midnight. */
function toDate(hhmm: string | null): Date {
  const d = new Date();
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  d.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0);
  return d;
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: spacing.sm },
  label: { ...type.label, color: t.textMuted },
  labelSpaced: { marginTop: spacing.sm },
  noDates: { ...type.caption, color: t.textFaint, lineHeight: 18 },

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
  chipSub: { ...type.caption, color: t.textFaint },

  times: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: {
    flex: 1,
    minHeight: MIN_TAP,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  timeActive: { borderColor: t.primary },
  timeDisabled: { opacity: 0.45 },
  timeCaption: { ...type.caption, color: t.textFaint },
  timeValue: { ...type.body, fontWeight: '600', color: t.text },
  timeValueEmpty: { color: t.textFaint, fontWeight: '400' },
  clear: {
    width: MIN_TAP,
    height: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
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

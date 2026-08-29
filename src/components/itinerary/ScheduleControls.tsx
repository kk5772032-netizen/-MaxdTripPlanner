import { Pressable, ScrollView, Text, View } from 'react-native';

import { addMinutes, formatDayLabel, tripDays } from '../../itinerary/schedule';
import { MIN_TAP, makeStyles, radius, spacing, type } from '../../theme';
import { TimeField } from '../TimeField';
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
            <View style={styles.timeField}>
              <Text style={styles.timeCaption}>Starts</Text>
              <TimeField
                value={stop.startTime}
                label="Start"
                placeholder="Not set"
                onChange={(next) =>
                  onChange(
                    next
                      ? {
                          startTime: next,
                          // A start with no end gets a sensible hour, so the
                          // stop has a shape on the timeline rather than being
                          // a single instant.
                          endTime: stop.endTime ?? addMinutes(next, 60),
                        }
                      : { startTime: null, endTime: null },
                  )
                }
              />
            </View>

            {stop.startTime ? (
              <View style={styles.timeField}>
                <Text style={styles.timeCaption}>Ends</Text>
                <TimeField
                  value={stop.endTime}
                  label="End"
                  placeholder="Not set"
                  onChange={(next) => onChange({ endTime: next })}
                />
              </View>
            ) : null}
          </View>
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

  times: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  timeField: { flex: 1, gap: 2 },
  timeCaption: { ...type.caption, color: t.textFaint },

  pressed: { opacity: 0.7 },
}));

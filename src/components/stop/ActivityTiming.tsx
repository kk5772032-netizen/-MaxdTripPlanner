import { Pressable, ScrollView, Text, View } from 'react-native';

import { formatDuration } from '../../itinerary/schedule';
import { MIN_TAP, makeStyles, radius, spacing, type } from '../../theme';
import { TimeField } from '../TimeField';

/**
 * When something happens and how long it takes.
 *
 * Durations are chips rather than a number field because nobody plans a museum
 * to the minute — the answer is always "about an hour", and offering a keypad
 * for that invites a precision the plan does not have. Tapping the chosen one
 * again clears it, so there is no separate "none" to hunt for.
 */
const PRESETS = [15, 30, 45, 60, 90, 120, 180] as const;

export function ActivityTiming({
  startTime,
  durationMin,
  onChange,
}: {
  startTime: string | null;
  durationMin: number | null;
  onChange: (patch: { startTime?: string | null; durationMin?: number | null }) => void;
}) {
  const styles = useStyles();

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Text style={styles.label}>Starts</Text>
        <TimeField
          value={startTime}
          label="Activity"
          placeholder="Any time"
          onChange={(next) => onChange({ startTime: next })}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Takes about</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {PRESETS.map((minutes) => {
            const active = durationMin === minutes;
            return (
              <Pressable
                key={minutes}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Takes about ${formatDuration(minutes)}`}
                onPress={() => onChange({ durationMin: active ? null : minutes })}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextOn]}>
                  {formatDuration(minutes)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: t.surfaceSunken,
  },
  field: { gap: spacing.sm },
  label: { ...type.captionStrong, color: t.textMuted },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    minHeight: 36,
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
  pressed: { opacity: 0.7 },
}));

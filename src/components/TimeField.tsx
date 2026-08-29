import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatTime } from '../itinerary/schedule';
import { HIT_SLOP, MIN_TAP, makeStyles, radius, spacing, type, useTheme } from '../theme';

/**
 * A time of day, as `HH:MM` or nothing at all.
 *
 * The picker underneath is different on every platform — a spinner on iOS, a
 * dialog on Android, and on web a component that renders nothing at all, which
 * is why there is a typed field there instead. Callers get one control and none
 * of that.
 */
export function TimeField({
  value,
  onChange,
  label,
  placeholder = 'Add a time',
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Names this field for screen readers: "Start", "Ends", "Activity time". */
  label: string;
  placeholder?: string;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [picking, setPicking] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} time: ${formatTime(value) ?? 'not set'}`}
          onPress={() => setPicking((open) => !open)}
          style={({ pressed }) => [
            styles.button,
            picking && styles.buttonActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="time-outline" size={16} color={t.textMuted} />
          <Text style={[styles.text, !value && styles.empty]}>
            {formatTime(value) ?? placeholder}
          </Text>
        </Pressable>

        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear the ${label.toLowerCase()} time`}
            hitSlop={HIT_SLOP}
            onPress={() => {
              setPicking(false);
              onChange(null);
            }}
            style={styles.clear}
          >
            <Ionicons name="close" size={16} color={t.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {picking ? (
        Platform.OS === 'web' ? (
          <TextInput
            accessibilityLabel={`${label} time, as hours colon minutes`}
            autoFocus
            defaultValue={value ?? ''}
            onChangeText={(text) => {
              if (/^\d{2}:\d{2}$/.test(text)) onChange(text);
            }}
            placeholder="HH:MM"
            placeholderTextColor={t.textFaint}
            style={styles.input}
          />
        ) : (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={toDate(value)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, picked) => {
                // Android's dialog dismisses itself; iOS's spinner stays up
                // until the field is tapped again.
                if (Platform.OS !== 'ios') setPicking(false);
                if (!picked) return;
                onChange(
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

/** Seeds the native picker. Nine o'clock is a kinder default than midnight. */
function toDate(hhmm: string | null): Date {
  const d = new Date();
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  d.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0);
  return d;
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
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
  buttonActive: { borderColor: t.primary },
  text: { ...type.body, color: t.text },
  empty: { color: t.textFaint },
  clear: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  input: {
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

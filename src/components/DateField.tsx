import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, isValidIsoDate, toIsoDate, todayIso } from '../dates';
import { colors, radius, spacing } from '../theme';

/** Single ISO date, defaulting to today. Used by the expense form. */
export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const asDate = isValidIsoDate(value) ? new Date(`${value}T00:00:00`) : new Date();
  const isToday = value === todayIso();

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a date"
          onPress={() => setOpen((o) => !o)}
          style={[styles.button, open && styles.buttonActive]}
        >
          <Text style={styles.value}>{formatDate(value) || 'Pick a date'}</Text>
        </Pressable>

        {!isToday ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange(todayIso())}
            style={styles.today}
          >
            <Text style={styles.todayText}>Today</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={asDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_, picked) => {
              if (Platform.OS !== 'ios') setOpen(false);
              if (picked) onChange(toIsoDate(picked));
            }}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setOpen(false)} style={styles.done}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  button: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  buttonActive: { borderColor: colors.primary },
  value: { fontSize: 15, color: colors.text },
  today: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  todayText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  pickerWrap: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  done: { alignItems: 'flex-end', padding: spacing.md },
  doneText: { color: colors.primary, fontWeight: '600' },
});

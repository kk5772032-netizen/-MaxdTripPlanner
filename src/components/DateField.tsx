import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, isValidIsoDate, toIsoDate, todayIso } from '../dates';
import { makeStyles, radius, spacing } from '../theme';

/** Single ISO date, defaulting to today. Used by the expense form. */
export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const styles = useStyles();
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

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  button: {
    flex: 1,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  buttonActive: { borderColor: t.primary },
  value: { fontSize: 15, color: t.text },
  today: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: t.primarySoft,
  },
  todayText: { fontSize: 13, fontWeight: '600', color: t.primary },
  pickerWrap: {
    marginTop: spacing.md,
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    overflow: 'hidden',
  },
  done: { alignItems: 'flex-end', padding: spacing.md },
  doneText: { color: t.primary, fontWeight: '600' },
}));

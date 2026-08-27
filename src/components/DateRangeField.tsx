import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate, isValidIsoDate, toIsoDate } from '../dates';
import { makeStyles, radius, spacing } from '../theme';

/**
 * `@react-native-community/datetimepicker` renders nothing at all on web — no
 * picker, no error — so dates simply could not be set in a browser. The web
 * build is a real target (expo export ships one), so it gets a typed field
 * instead of a silent dead end.
 */
const USE_NATIVE_PICKER = Platform.OS !== 'web';

/**
 * Start/end date pair.
 *
 * Picking a start later than the current end pushes the end along with it,
 * which is what people expect when they realise the trip moved a week.
 */
export function DateRangeField({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState<'start' | 'end' | null>(null);

  const toDate = (iso: string | null): Date =>
    iso && isValidIsoDate(iso) ? new Date(`${iso}T00:00:00`) : new Date();

  const handlePicked = (which: 'start' | 'end', picked: Date | undefined) => {
    // Android fires onChange for dismiss too, with no date. On web the field
    // stays open: closing it mid-keystroke would fight the person typing.
    if (Platform.OS === 'android') setOpen(null);
    if (!picked) return;

    const iso = toIsoDate(picked);
    if (which === 'start') {
      const nextEnd = end && end < iso ? iso : end;
      onChange(iso, nextEnd);
    } else {
      const nextStart = start && start > iso ? iso : start;
      onChange(nextStart, iso);
    }
  };

  return (
    <View>
      <View style={styles.row}>
        <DateButton
          label="Start"
          value={start}
          onPress={() => setOpen(open === 'start' ? null : 'start')}
          active={open === 'start'}
        />
        <DateButton
          label="End"
          value={end}
          onPress={() => setOpen(open === 'end' ? null : 'end')}
          active={open === 'end'}
        />
      </View>

      {open && !USE_NATIVE_PICKER ? (
        <View style={styles.pickerWrap}>
          <TextInput
            accessibilityLabel={`${open === 'start' ? 'Start' : 'End'} date, as year dash month dash day`}
            autoFocus
            defaultValue={(open === 'start' ? start : end) ?? ''}
            placeholder="YYYY-MM-DD"
            style={styles.webInput}
            onChangeText={(text) => {
              if (!isValidIsoDate(text)) return;
              handlePicked(open, new Date(`${text}T00:00:00`));
            }}
          />
        </View>
      ) : null}

      {open && USE_NATIVE_PICKER ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={toDate(open === 'start' ? start : end)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={open === 'end' && start ? toDate(start) : undefined}
            onChange={(_, picked) => handlePicked(open, picked)}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setOpen(null)} style={styles.done}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {start || end ? (
        <Pressable onPress={() => onChange(null, null)} style={styles.clear}>
          <Text style={styles.clearText}>Clear dates</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DateButton({
  label,
  value,
  onPress,
  active,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
  active: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} date`}
      onPress={onPress}
      style={[styles.dateButton, active && styles.dateButtonActive]}
    >
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={[styles.dateValue, !value && styles.datePlaceholder]}>
        {value ? formatDate(value) : 'Not set'}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: spacing.md },
  dateButton: {
    flex: 1,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dateButtonActive: { borderColor: t.primary },
  webInput: {
    padding: spacing.md,
    fontSize: 15,
    color: t.text,
    fontVariant: ['tabular-nums'],
  },
  dateLabel: { fontSize: 12, color: t.textMuted, marginBottom: 2 },
  dateValue: { fontSize: 15, color: t.text, fontWeight: '500' },
  datePlaceholder: { color: t.textFaint, fontWeight: '400' },
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
  clear: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  clearText: { color: t.textMuted, fontSize: 13 },
}));

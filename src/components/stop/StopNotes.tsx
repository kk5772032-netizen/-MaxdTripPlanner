import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTripStore } from '../../state/tripStore';
import { colors, radius, spacing, type } from '../../theme';
import type { Stop } from '../../types';
import { Input } from '../ui';

/** How long after the last keystroke the note is written to SQLite. */
const SAVE_DELAY_MS = 600;

/**
 * Free-text note for a stop, shown above the tabs because it belongs to the
 * stop rather than to any one of them.
 *
 * Saves on a debounce rather than behind a button — there's nothing to confirm
 * about a note, and a Save button people forget to press loses more text than
 * it protects.
 */
export function StopNotes({ stop }: { stop: Stop }) {
  const updateStop = useTripStore((s) => s.updateStop);
  const [text, setText] = useState(stop.notes ?? '');
  const [saved, setSaved] = useState(false);

  // Only reset from props when a different stop is shown; re-syncing on every
  // store update would fight the user mid-sentence.
  const stopId = useRef(stop.id);
  useEffect(() => {
    if (stopId.current !== stop.id) {
      stopId.current = stop.id;
      setText(stop.notes ?? '');
    }
  }, [stop.id, stop.notes]);

  useEffect(() => {
    const current = stop.notes ?? '';
    if (text === current) return;

    const timer = setTimeout(() => {
      void updateStop(stop.id, { notes: text.trim() || null }).then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      });
    }, SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [text, stop.id, stop.notes, updateStop]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>Notes</Text>
        {saved ? <Text style={styles.saved}>Saved</Text> : null}
      </View>
      <Input
        value={text}
        onChangeText={setText}
        placeholder="Best at sunset · entry from the south gate"
        multiline
        style={styles.input}
        accessibilityLabel={`Notes for ${stop.name}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...type.label, color: colors.textMuted },
  saved: { ...type.captionStrong, color: colors.under },
  input: { minHeight: 60, textAlignVertical: 'top', borderRadius: radius.md },
});

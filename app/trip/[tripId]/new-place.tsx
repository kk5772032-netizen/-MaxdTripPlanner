import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Button, Field, Input } from '../../../src/components/ui';
import { useTripStore } from '../../../src/state/tripStore';
import { colors, spacing } from '../../../src/theme';

/**
 * Add a stop by typing it. Phase 3 puts Places autocomplete above this form and
 * keeps the manual fields as the fallback for when the API is unreachable or
 * the place simply isn't in Google's index.
 */
export default function NewPlaceScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const addStop = useTripStore((s) => s.addStop);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addStop({
        googlePlaceId: null,
        name: name.trim(),
        address: address.trim() || null,
        lat: null,
        lng: null,
        rating: null,
        photoRef: null,
        plannedBudgetMinor: null,
        notes: notes.trim() || null,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Place name">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="India Gate"
            autoFocus
            returnKeyType="next"
          />
        </Field>

        <Field label="Address" hint="Optional.">
          <Input
            value={address}
            onChangeText={setAddress}
            placeholder="Kartavya Path, New Delhi"
          />
        </Field>

        <Field label="Notes" hint="Optional. Anything you want to remember about this stop.">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Best at sunset"
            multiline
            style={styles.notes}
          />
        </Field>

        <Button title="Add stop" onPress={save} disabled={!canSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  notes: { minHeight: 80, textAlignVertical: 'top' },
});

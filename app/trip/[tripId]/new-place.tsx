import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PlacesError, photoUrl, placeDetails } from '../../../src/api/places';
import { PlaceSearchInput } from '../../../src/components/PlaceSearchInput';
import { Button, Card, Field, Input } from '../../../src/components/ui';
import { useTripStore } from '../../../src/state/tripStore';
import { colors, radius, spacing } from '../../../src/theme';
import type { PlaceDetails } from '../../../src/types';

/**
 * Add a stop.
 *
 * Search is the main path; the manual fields below it stay available for
 * places Google doesn't know, and become the only path when the API key is
 * missing or the network is down.
 */
export default function NewPlaceScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const addStop = useTripStore((s) => s.addStop);

  const [candidate, setCandidate] = useState<PlaceDetails | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const pickSuggestion = async (
    suggestion: { placeId: string; primaryText: string; secondaryText: string },
    sessionToken: string,
  ) => {
    setFetching(true);
    setError(null);
    try {
      // Passing the session token closes the autocomplete session, so the
      // typing that led here is billed once rather than per keystroke.
      setCandidate(await placeDetails(suggestion.placeId, { sessionToken }));
    } catch (e) {
      setError(
        e instanceof PlacesError
          ? e.message
          : 'Could not load that place. Add it manually instead.',
      );
      // Pre-fill the manual form so the user isn't stranded.
      setManualOpen(true);
      setName(suggestion.primaryText);
      setAddress(suggestion.secondaryText);
    } finally {
      setFetching(false);
    }
  };

  const confirmCandidate = async () => {
    if (!candidate) return;
    setSaving(true);
    try {
      await addStop({
        googlePlaceId: candidate.placeId,
        name: candidate.name,
        address: candidate.address,
        lat: candidate.lat,
        lng: candidate.lng,
        rating: candidate.rating,
        photoRef: candidate.photoRef,
        plannedBudgetMinor: null,
        notes: null,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const saveManual = async () => {
    if (!name.trim()) return;
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

  const photo = candidate ? photoUrl(candidate.photoRef, 400) : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PlaceSearchInput onSelect={pickSuggestion} autoFocus />

        {fetching ? <Text style={styles.status}>Loading place details…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {candidate ? (
          <Card style={styles.preview}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={150} />
            ) : null}
            <Text style={styles.previewName}>{candidate.name}</Text>
            {candidate.address ? (
              <Text style={styles.previewAddress}>{candidate.address}</Text>
            ) : null}
            {candidate.rating != null ? (
              <Text style={styles.previewRating}>★ {candidate.rating.toFixed(1)}</Text>
            ) : null}

            <View style={styles.previewActions}>
              <Button
                title="Add this stop"
                onPress={confirmCandidate}
                loading={saving}
                style={styles.flexButton}
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCandidate(null)}
                style={styles.flexButton}
              />
            </View>
          </Card>
        ) : null}

        {!candidate ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setManualOpen((open) => !open)}
              style={styles.manualToggle}
            >
              <Text style={styles.manualToggleText}>
                {manualOpen ? 'Hide manual entry' : 'Add manually instead'}
              </Text>
            </Pressable>

            {manualOpen ? (
              <View style={styles.manual}>
                <Field label="Place name">
                  <Input value={name} onChangeText={setName} placeholder="India Gate" />
                </Field>
                <Field label="Address" hint="Optional.">
                  <Input
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Kartavya Path, New Delhi"
                  />
                </Field>
                <Field label="Notes" hint="Optional. Anything worth remembering about this stop.">
                  <Input
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Best at sunset"
                    multiline
                    style={styles.notes}
                  />
                </Field>
                <Button
                  title="Add stop"
                  onPress={saveManual}
                  disabled={!name.trim() || saving}
                  loading={saving}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  status: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.over, fontSize: 13 },
  preview: { gap: spacing.xs },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  previewName: { fontSize: 17, fontWeight: '600', color: colors.text },
  previewAddress: { fontSize: 13, color: colors.textMuted },
  previewRating: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  previewActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  flexButton: { flex: 1 },
  manualToggle: { alignSelf: 'flex-start' },
  manualToggleText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  manual: { gap: 0 },
  notes: { minHeight: 72, textAlignVertical: 'top' },
});

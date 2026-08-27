import { Ionicons } from '@expo/vector-icons';
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
import {
  Button,
  Card,
  Field,
  Input,
  Loading,
  Notice,
  notifySuccess,
} from '../../../src/components/ui';
import { useTripStore } from '../../../src/state/tripStore';
import { makeStyles, radius, spacing, type, useTheme } from '../../../src/theme';
import type { PlaceDetails } from '../../../src/types';

/**
 * Add a stop.
 *
 * Search is the main path; the manual fields below it stay available for
 * places Google doesn't know, and become the only path when the API key is
 * missing or the network is down.
 */
export default function NewPlaceScreen() {
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();
  // `day` arrives when the stop was added from a specific day on the timeline,
  // so it lands where the user was looking rather than in Unscheduled.
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
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
        dayDate: day ?? null,
      });
      notifySuccess();
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
        dayDate: day ?? null,
      });
      notifySuccess();
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

        {fetching ? <Loading label="Loading place details…" /> : null}
        {error ? <Notice tone="danger" title="Couldn't load that place" body={error} /> : null}

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
              <View style={styles.previewRatingRow}>
                <Ionicons name="star" size={13} color={t.near} />
                <Text style={styles.previewRating}>{candidate.rating.toFixed(1)}</Text>
              </View>
            ) : null}

            <View style={styles.previewActions}>
              <Button
                title="Add this stop"
                icon="add"
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
                  icon="add"
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

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, backgroundColor: t.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },

  preview: { gap: spacing.xs },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: t.bg,
  },
  previewName: { ...type.heading, color: t.text },
  previewAddress: { ...type.caption, color: t.textMuted },
  previewRatingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  previewRating: { ...type.captionStrong, color: t.textMuted },
  previewActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  flexButton: { flex: 1 },
  manualToggle: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  manualToggleText: { ...type.label, color: t.primary },
  manual: { gap: 0 },
  notes: { minHeight: 72, textAlignVertical: 'top' },
}));

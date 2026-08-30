import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deletePhoto, pickPhotos } from '../../documents';
import { useToastStore } from '../../state/toastStore';
import { useTripStore } from '../../state/tripStore';
import { makeStyles, radius, spacing, type, useTheme } from '../../theme';
import type { JournalEntry } from '../../types';
import { Button, Input } from '../ui';

/**
 * What actually happened on a day.
 *
 * A trip planner that closes the moment the trip starts is half an app, and
 * this is the half that makes it worth keeping afterwards. It appears only on
 * days that have happened, or days that already have something in them —
 * offering to journal a Tuesday three months away is the app asking a question
 * nobody can answer yet.
 */
export function DayJournal({
  dayDate,
  entry,
  today,
}: {
  dayDate: string;
  entry: JournalEntry | null;
  /** ISO date, injectable so tests can fix the calendar. */
  today: string;
}) {
  const styles = useStyles();
  const t = useTheme();
  const { setJournalNote, addJournalPhotos, removeJournalPhoto } = useTripStore();
  const show = useToastStore((s) => s.show);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(entry?.note ?? '');
  const [busy, setBusy] = useState(false);
  /** Index of the photo being looked at, or null. */
  const [viewing, setViewing] = useState<number | null>(null);

  const hasEntry = !!entry && (!!entry.note || entry.photos.length > 0);
  // A future day has nothing to look back on. Once something is written the
  // entry stays visible whatever the date, so an early note is not hidden.
  if (dayDate > today && !hasEntry) return null;

  const addPhotos = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await pickPhotos();
      if (result.ok) await addJournalPhotos(dayDate, result.uris);
      else if (result.reason) show({ message: result.reason });
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (photoId: string) => {
    const uri = await removeJournalPhoto(photoId);
    // The row is gone either way; the file is best effort.
    if (uri) await deletePhoto(uri);
  };

  const saveNote = () => {
    if (draft === (entry?.note ?? '')) return;
    void setJournalNote(dayDate, draft.trim() || null);
  };

  if (!hasEntry && !open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add a note or photos for this day`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.invite, pressed && styles.pressed]}
      >
        <Ionicons name="camera-outline" size={15} color={t.textFaint} />
        <Text style={styles.inviteText}>How was this day?</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      {entry && entry.photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {entry.photos.map((photo, i) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1} of ${entry.photos.length}`}
              onPress={() => setViewing(i)}
              onLongPress={() => void removeOne(photo.id)}
              style={styles.frame}
            >
              <Image
                source={{ uri: photo.uri }}
                style={styles.photo}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Input
        value={draft}
        onChangeText={setDraft}
        onBlur={saveNote}
        placeholder="Anything worth remembering"
        multiline
        style={styles.note}
        accessibilityLabel="What happened today"
      />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photos to this day"
          onPress={() => void addPhotos()}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="images-outline" size={15} color={t.primary} />
          <Text style={styles.actionText}>Add photos</Text>
        </Pressable>

        {entry && entry.photos.length > 0 ? (
          <Text style={styles.hint}>Tap a photo to see it, long-press to remove.</Text>
        ) : null}
      </View>

      {/* Full-screen rather than a share-sheet hand-off: these are your own
          photos and looking at them is the point, not sending them somewhere. */}
      <Modal
        visible={viewing !== null && !!entry}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
        statusBarTranslucent
      >
        <View style={styles.viewer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close the photo"
            style={StyleSheet.absoluteFill}
            onPress={() => setViewing(null)}
          />

          {entry && viewing !== null && entry.photos[viewing] ? (
            <>
              <Image
                source={{ uri: entry.photos[viewing].uri }}
                style={styles.viewerImage}
                contentFit="contain"
                transition={120}
              />
              <View style={styles.viewerBar}>
                <Text style={styles.viewerCount}>
                  {viewing + 1} of {entry.photos.length}
                </Text>
                <Button
                  title="Remove"
                  icon="trash-outline"
                  variant="danger"
                  onPress={() => {
                    const id = entry.photos[viewing].id;
                    setViewing(null);
                    void removeOne(id);
                  }}
                />
                <Button title="Close" variant="secondary" onPress={() => setViewing(null)} />
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  inviteText: { ...type.caption, color: t.textFaint },

  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    backgroundColor: t.surfaceSunken,
  },
  strip: { gap: spacing.sm },
  frame: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: t.surface,
  },
  photo: { width: '100%', height: '100%' },

  note: { minHeight: 62, textAlignVertical: 'top', paddingTop: spacing.md },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionText: { ...type.label, color: t.primary },
  hint: { flex: 1, ...type.caption, color: t.textFaint },

  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  viewerImage: { width: '100%', height: '70%' },
  viewerBar: { gap: spacing.sm },
  viewerCount: {
    ...type.caption,
    color: '#FFFFFF',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  pressed: { opacity: 0.6 },
}));

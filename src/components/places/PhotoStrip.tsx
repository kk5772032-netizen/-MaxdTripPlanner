import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';

import { photoUrl } from '../../api/places';
import { makeStyles, radius, spacing } from '../../theme';

/**
 * The photos of a place, as a strip you can swipe.
 *
 * Renders nothing at all when there are no photos or no API key — an empty
 * frame with a broken-image glyph in it is worse than a screen that simply
 * doesn't mention pictures.
 */
export function PhotoStrip({
  photoRefs,
  name,
  height = 168,
}: {
  photoRefs: string[];
  /** For the screen reader: "Photo 2 of 5 of Humayun's Tomb". */
  name: string;
  height?: number;
}) {
  const styles = useStyles();

  const urls = photoRefs
    .map((ref) => photoUrl(ref, 800))
    .filter((url): url is string => !!url);
  if (urls.length === 0) return null;

  const single = urls.length === 1;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      // One photo shouldn't pretend to be a carousel you can flick.
      scrollEnabled={!single}
    >
      {urls.map((url, i) => (
        <View key={url} style={[styles.frame, { height }, single && styles.frameSingle]}>
          <Image
            accessibilityLabel={`Photo ${i + 1} of ${urls.length} of ${name}`}
            source={{ uri: url }}
            style={styles.photo}
            contentFit="cover"
            transition={200}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  strip: { gap: spacing.sm },
  frame: {
    width: 248,
    borderRadius: radius.lg,
    overflow: 'hidden',
    // Shows through until the photo decodes, so the layout never jumps.
    backgroundColor: t.surfaceSunken,
  },
  frameSingle: { width: '100%', flex: 1, minWidth: 280 },
  photo: { width: '100%', height: '100%' },
}));

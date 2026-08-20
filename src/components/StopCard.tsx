import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { elevation, makeStyles, radius, spacing, type, useTheme } from '../theme';
import type { Stop } from '../types';

/**
 * One row in the itinerary list.
 *
 * `dragHandle` is rendered by the parent so the card doesn't need to know how
 * dragging is wired; `footer` carries the budget bar once that exists.
 */
export const StopCard = memo(function StopCard({
  stop,
  index,
  subtitle,
  footer,
  dragHandle,
  dragging,
  onPress,
  onLongPress,
}: {
  stop: Stop;
  index: number;
  subtitle?: string;
  footer?: React.ReactNode;
  dragHandle?: React.ReactNode;
  dragging?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Stop ${index + 1}: ${stop.name}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        elevation.sm,
        pressed && styles.pressed,
        dragging && [styles.dragging, elevation.lg],
      ]}
    >
      <View style={styles.header}>
        <View style={styles.index}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {stop.name}
          </Text>
          {stop.address ? (
            <Text style={styles.address} numberOfLines={1}>
              {stop.address}
            </Text>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {stop.rating != null ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={11} color={t.near} />
            <Text style={styles.ratingText}>{stop.rating.toFixed(1)}</Text>
          </View>
        ) : null}

        {dragHandle}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Pressable>
  );
});

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.92 },
  dragging: { borderColor: t.primary, transform: [{ scale: 1.02 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  index: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { ...type.captionStrong, color: t.primary },
  titleBlock: { flex: 1, gap: 1 },
  name: { ...type.bodyStrong, color: t.text },
  address: { ...type.caption, color: t.textMuted },
  subtitle: { ...type.caption, color: t.textFaint, marginTop: 2 },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: t.surfaceSunken,
  },
  ratingText: { ...type.captionStrong, color: t.textMuted },
  footer: { marginTop: spacing.md },
}));

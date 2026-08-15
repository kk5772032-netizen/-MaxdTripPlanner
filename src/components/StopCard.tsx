import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Stop ${index + 1}: ${stop.name}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        dragging && styles.dragging,
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
            <Text style={styles.ratingText}>★ {stop.rating.toFixed(1)}</Text>
          </View>
        ) : null}

        {dragHandle}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.9 },
  dragging: {
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  index: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  titleBlock: { flex: 1, gap: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  address: { fontSize: 12, color: colors.textMuted },
  subtitle: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  rating: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  ratingText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  footer: { marginTop: spacing.md },
});

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReorderableList, {
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';

import { colors, spacing } from '../theme';
import type { Stop } from '../types';
import { StopCard } from './StopCard';

/**
 * The itinerary list, reorderable by dragging the handle or long-pressing the
 * card. Order is committed to `stops.sequence` by the caller's `onReorder`.
 */
export function StopList({
  stops,
  renderFooter,
  renderSubtitle,
  onPressStop,
  onReorder,
  ListHeaderComponent,
  ListEmptyComponent,
  contentContainerStyle,
}: {
  stops: Stop[];
  renderFooter?: (stop: Stop) => ReactNode;
  renderSubtitle?: (stop: Stop) => string | undefined;
  onPressStop: (stop: Stop) => void;
  onReorder: (orderedIds: string[]) => void;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  contentContainerStyle?: object;
}) {
  return (
    <ReorderableList
      data={stops}
      keyExtractor={(stop) => stop.id}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      ListHeaderComponent={ListHeaderComponent as never}
      ListEmptyComponent={ListEmptyComponent as never}
      onReorder={({ from, to }) => {
        const ids = stops.map((s) => s.id);
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        onReorder(ids);
      }}
      renderItem={({ item, index }) => (
        <DraggableStop
          stop={item}
          index={index}
          subtitle={renderSubtitle?.(item)}
          footer={renderFooter?.(item)}
          onPress={() => onPressStop(item)}
        />
      )}
    />
  );
}

function DraggableStop({
  stop,
  index,
  subtitle,
  footer,
  onPress,
}: {
  stop: Stop;
  index: number;
  subtitle?: string;
  footer?: ReactNode;
  onPress: () => void;
}) {
  // These hooks only work inside a ReorderableList item, which is why the row
  // lives here rather than in StopCard.
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <View style={styles.item}>
      <StopCard
        stop={stop}
        index={index}
        subtitle={subtitle}
        footer={footer}
        dragging={isActive}
        onPress={onPress}
        onLongPress={drag}
        dragHandle={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reorder ${stop.name}`}
            onLongPress={drag}
            delayLongPress={120}
            hitSlop={8}
            style={styles.handle}
          >
            <Ionicons name="reorder-two" size={22} color={colors.textFaint} />
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  item: { marginBottom: spacing.md },
  handle: { paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
});

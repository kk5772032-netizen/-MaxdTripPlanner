import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '../state/toastStore';
import { colors, elevation, radius, spacing, type } from '../theme';

/**
 * Renders the current toast above everything else.
 *
 * Mounted once at the root. `offsetBottom` lets a screen with a sticky bar push
 * it clear — a toast that covers the thing it's reporting on is worse than no
 * toast.
 */
export function ToastHost({ offsetBottom = 0 }: { offsetBottom?: number }) {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  const slide = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    const id = toast.id;

    slide.setValue(0);
    progress.setValue(0);
    Animated.timing(slide, {
      toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    // The bar is the countdown made visible, so it uses the same duration the
    // timer does rather than an approximation.
    if (toast.undo) {
      Animated.timing(progress, {
        toValue: 1, duration: toast.durationMs, easing: Easing.linear, useNativeDriver: false,
      }).start();
    }

    const timer = setTimeout(() => dismiss(id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast, dismiss, slide, progress]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: spacing.lg + offsetBottom + insets.bottom },
        {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <View style={[styles.toast, elevation.lg]}>
        <Ionicons
          name={toast.icon}
          size={20}
          color={toast.tone === 'danger' ? colors.over : '#fff'}
        />
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>

        {toast.undo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            hitSlop={12}
            onPress={() => {
              const { undo, id } = toast;
              dismiss(id);
              void undo?.();
            }}
          >
            <Text style={styles.action}>Undo</Text>
          </Pressable>
        ) : null}

        {toast.undo ? (
          <Animated.View
            style={[
              styles.progress,
              { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] }) },
            ]}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(12,17,29,0.96)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  message: { flex: 1, ...type.body, color: '#fff' },
  action: { ...type.bodyStrong, color: '#93B4FD' },
  progress: {
    position: 'absolute', left: 0, bottom: 0, height: 2,
    backgroundColor: '#93B4FD', opacity: 0.7,
  },
});

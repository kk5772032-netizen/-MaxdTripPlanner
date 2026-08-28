import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { animateTo, duration, easing, useReducedMotion } from '../motion';
import { makeStyles, radius, useTheme } from '../theme';

/**
 * A checkbox whose tick arrives rather than appears.
 *
 * The tick scales in from 0.8 over 150ms while the box fills — small enough to
 * feel like a response to the finger rather than an animation you sit through.
 * Under reduce motion the scale is dropped and only the fade remains.
 */
export function Checkbox({ checked }: { checked: boolean }) {
  const styles = useStyles();
  const t = useTheme();
  const reduced = useReducedMotion();

  // Starts settled: a list of already-ticked items should not play a dozen
  // animations the moment it mounts.
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      progress.setValue(checked ? 1 : 0);
      return;
    }
    const animation = animateTo(progress, checked ? 1 : 0, {
      ms: reduced ? duration.reduced : duration.micro,
      curve: checked ? easing.enter : easing.exit,
      reduced: false, // the fade itself still runs; only the scale is dropped
      useNativeDriver: true,
    });
    return () => animation.stop();
  }, [checked, progress, reduced]);

  return (
    <Animated.View
      style={[
        styles.box,
        checked && styles.boxChecked,
        {
          borderColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [t.borderStrong, t.under],
          }),
        },
      ]}
    >
      <Animated.View
        style={{
          opacity: progress,
          transform: [
            {
              scale: reduced
                ? 1
                : progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
            },
          ],
        }}
      >
        <Ionicons name="checkmark" size={14} color={t.textOnPrimary} />
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: t.under },
}));

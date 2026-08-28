import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * Motion tokens, and the one hook that can switch all of it off.
 *
 * Durations and easing come from the design spec (X02): motion here explains a
 * change — where a thing went, what just happened — and never decorates. Nothing
 * bounces or springs past its target.
 *
 * Every animation in the app goes through `useReducedMotion`. Under the OS
 * setting, movement is replaced by a plain cross-fade rather than being made
 * faster: for someone with vestibular sensitivity a quick slide is still a
 * slide. This is why the durations below are read at call time instead of
 * baked into a component.
 */

export const duration = {
  /** Press states, checkboxes — anything under the finger. */
  micro: 150,
  /** Sheets, tab changes, toasts arriving. */
  standard: 250,
  /** Screen transitions, a budget bar redrawing itself. */
  large: 350,
  /** The cross-fade that replaces movement under reduce motion. */
  reduced: 100,
} as const;

/** Decelerate on enter, accelerate on exit — the standard material curve. */
export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
} as const;

/** A slow, low-contrast sweep. Long enough to read as "loading", not "broken". */
export const SHIMMER_MS = 1400;

/**
 * Whether the OS asks for reduced motion.
 *
 * Starts false and corrects itself on mount: the initial read is async, and
 * blocking the first frame on an accessibility query would cost every user a
 * stutter to serve a setting most don't have on.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      // A platform that can't answer is not a reason to break the screen.
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * Animates `value` to `to`, honouring reduce motion by snapping instead.
 *
 * Returns the animation so callers can compose it; it is already started.
 */
export function animateTo(
  value: Animated.Value,
  to: number,
  {
    ms = duration.standard,
    reduced = false,
    useNativeDriver = false,
    curve = easing.standard,
  }: {
    ms?: number;
    reduced?: boolean;
    useNativeDriver?: boolean;
    curve?: (t: number) => number;
  } = {},
): Animated.CompositeAnimation {
  const animation = Animated.timing(value, {
    toValue: to,
    // Not "faster": under reduce motion the movement is gone and only the
    // cross-fade at the call site remains.
    duration: reduced ? 0 : ms,
    easing: curve,
    useNativeDriver,
  });
  animation.start();
  return animation;
}

/**
 * An Animated.Value that follows `target`, and the previous target it came
 * from. Used for widths and counters, which animate between two known numbers.
 */
export function useAnimatedNumber(
  target: number,
  { ms = duration.large, reduced = false }: { ms?: number; reduced?: boolean } = {},
): Animated.Value {
  const value = useRef(new Animated.Value(target)).current;
  const first = useRef(true);

  useEffect(() => {
    // The first render is the initial state, not a change to animate: a bar
    // that always grows from zero on mount is an animation about nothing.
    if (first.current) {
      first.current = false;
      value.setValue(target);
      return;
    }
    const animation = animateTo(value, target, { ms, reduced });
    return () => animation.stop();
  }, [target, ms, reduced, value]);

  return value;
}

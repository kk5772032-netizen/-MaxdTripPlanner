import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { progressRatio, statusFor } from '../budget/engine';
import { formatMoney } from '../budget/money';
import { animateTo, duration, useAnimatedNumber, useReducedMotion } from '../motion';
import { makeStyles, radius, spacing, statusColorOf, type, useTheme } from '../theme';
import type { BudgetStatus } from '../types';

/**
 * Progress against a cap: green under 80%, amber 80–100%, red over.
 *
 * Always shows "₹X of ₹Y" — a bar without its numbers makes people guess. When
 * spending has passed the cap the fill stays full and the label carries the
 * overage, since a bar can't render past 100%.
 */
export function BudgetBar({
  actual,
  cap,
  currency,
  label,
  planned,
  compact = false,
  style,
}: {
  actual: number;
  /** Null renders the "no budget set" variant rather than an empty bar. */
  cap: number | null;
  currency: string;
  label?: string;
  /** When given, drawn as a tick mark: what the user intends to spend. */
  planned?: number;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const t = useTheme();
  const reduced = useReducedMotion();
  const status: BudgetStatus = statusFor(actual, cap);
  const ratio = progressRatio(actual, cap);
  const color = statusColorOf(t, status);

  // The bar redraws itself when an expense lands, rather than teleporting: the
  // movement is the feedback that the money went somewhere.
  const width = useAnimatedNumber(ratio, { reduced });

  // Colour is cross-faded through a second, overlaid fill. Interpolating
  // between two hex strings would pass through whatever sits between them,
  // which for green→red is a muddy brown that means nothing.
  const previousColor = useRef(color);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (previousColor.current === color) return;
    fade.setValue(0);
    const animation = animateTo(fade, 1, { ms: duration.large, reduced });
    previousColor.current = color;
    return () => animation.stop();
  }, [color, fade, reduced]);

  // The planned marker only means something inside the bar's own scale.
  const plannedRatio =
    planned != null && cap !== null && cap > 0 ? Math.min(1, planned / cap) : null;

  const over = cap !== null && actual > cap;

  return (
    <View
      style={style}
      // Screen readers should announce the whole bar as one progress control,
      // not read the label and the amounts as two unrelated pieces of text.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ now: Math.round(ratio * 100), min: 0, max: 100 }}
    >
      {label || !compact ? (
        <View style={styles.header}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          <Text style={[styles.amounts, compact && styles.amountsCompact]}>
            {cap === null
              ? `${formatMoney(actual, currency, { compact: true })} spent`
              : `${formatMoney(actual, currency, { compact: true })} of ${formatMoney(cap, currency, { compact: true })}`}
          </Text>
        </View>
      ) : null}

      <View style={[styles.track, compact && styles.trackCompact]}>
        {cap === null ? (
          <View style={styles.trackUnset} />
        ) : (
          <>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: width.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: previousColor.current,
                },
              ]}
            >
              <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: fade }]}
              />
            </Animated.View>
            {plannedRatio !== null && plannedRatio > 0 && plannedRatio < 1 ? (
              <View style={[styles.plannedTick, { left: `${plannedRatio * 100}%` }]} />
            ) : null}
          </>
        )}
      </View>

      {cap === null && !compact ? (
        <Text style={styles.note}>No budget set for this stop.</Text>
      ) : null}
      {over ? (
        <View style={styles.overRow}>
          <Ionicons name="alert-circle" size={13} color={t.over} />
          <Text style={[styles.note, styles.noteOver]}>
            {formatMoney(actual - cap!, currency, { compact: true })} over budget
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  label: { ...type.label, color: t.textMuted },
  amounts: { ...type.label, color: t.text },
  amountsCompact: { ...type.caption, color: t.textMuted },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: t.surfaceSunken,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trackCompact: { height: 6 },
  trackUnset: {
    height: '100%',
    width: '100%',
    backgroundColor: t.border,
    opacity: 0.6,
  },
  fill: { height: '100%', borderRadius: radius.pill },
  plannedTick: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: t.text,
    opacity: 0.35,
  },
  note: { ...type.caption, color: t.textFaint, marginTop: spacing.xs },
  overRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  noteOver: { color: t.overText, fontWeight: '600', marginTop: 0 },
}));

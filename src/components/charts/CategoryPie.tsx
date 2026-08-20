import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { formatMoney } from '../../budget/money';
import { categoryLabels, makeStyles, radius, spacing, useTheme } from '../../theme';
import type { ExpenseCategory } from '../../types';

/**
 * Actual spend by category, as a donut.
 *
 * A donut is defensible here only because there are at most five slices and
 * every one is direct-labelled with its own amount and share beside the chart —
 * the ring shows proportion at a glance, the list carries the numbers. Slices
 * are separated by a small surface-coloured gap so adjacent colours never
 * touch.
 */
export function CategoryPie({
  totals,
  currency,
  size = 180,
}: {
  totals: Record<ExpenseCategory, number>;
  currency: string;
  size?: number;
}) {
  const styles = useStyles();
  const t = useTheme();
  const entries = (Object.entries(totals) as [ExpenseCategory, number][])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  if (total === 0) {
    return (
      <Text style={styles.empty}>
        Nothing logged yet — the breakdown appears once you add expenses.
      </Text>
    );
  }

  const radius = size / 2;
  const innerRadius = radius * 0.58;
  // Degrees of surface between slices. Skipped when there's only one slice,
  // where a gap would just look like a broken ring.
  const gap = entries.length > 1 ? 1.5 : 0;

  let angle = -90; // start at 12 o'clock
  const slices = entries.map(([category, amount]) => {
    const sweep = (amount / total) * 360;
    const path = donutSlice(
      radius,
      radius,
      radius,
      innerRadius,
      angle + gap / 2,
      angle + sweep - gap / 2,
    );
    angle += sweep;
    return { category, amount, path, share: amount / total };
  });

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <G>
          {slices.map((slice) => (
            <Path key={slice.category} d={slice.path} fill={t.categories[slice.category]} />
          ))}
        </G>
      </Svg>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.category} style={styles.legendRow}>
            <View
              style={[styles.swatch, { backgroundColor: t.categories[slice.category] }]}
            />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {categoryLabels[slice.category]}
            </Text>
            <Text style={styles.legendValue}>
              {formatMoney(slice.amount, currency, { compact: true })}
            </Text>
            <Text style={styles.legendShare}>{Math.round(slice.share * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** SVG path for one donut segment, angles in degrees clockwise from 3 o'clock. */
function donutSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startDeg: number,
  endDeg: number,
): string {
  // A full circle can't be drawn as a single arc — both endpoints coincide, so
  // the renderer draws nothing. Stop just short of closing it.
  const end = endDeg - startDeg >= 360 ? startDeg + 359.99 : endDeg;
  const largeArc = end - startDeg > 180 ? 1 : 0;

  const p1 = polar(cx, cy, outer, startDeg);
  const p2 = polar(cx, cy, outer, end);
  const p3 = polar(cx, cy, inner, end);
  const p4 = polar(cx, cy, inner, startDeg);

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', gap: spacing.lg },
  legend: { alignSelf: 'stretch', gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13, color: t.text },
  legendValue: { fontSize: 13, fontWeight: '600', color: t.text },
  legendShare: { fontSize: 12, color: t.textFaint, width: 38, textAlign: 'right' },
  empty: { fontSize: 13, color: t.textMuted, lineHeight: 19 },
}));

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { formatMoney } from '../../budget/money';
import { colors, spacing, statusColor } from '../../theme';
import type { StopSummary } from '../../budget/engine';

/**
 * Planned vs actual for each stop, as paired horizontal bars.
 *
 * Horizontal rather than vertical because the category labels are stop names —
 * long, arbitrary text that would have to be rotated or truncated on a vertical
 * axis. Both bars share one scale (the largest value on the chart), so bar
 * lengths are comparable across stops; there is no second axis anywhere.
 *
 * Planned is drawn in a recessive gray and actual in its budget status colour,
 * so the thing you scan for — where actual has outrun the plan — is the thing
 * that carries the colour.
 */
export function PlannedVsActualChart({
  stops,
  currency,
}: {
  stops: StopSummary[];
  currency: string;
}) {
  const max = Math.max(1, ...stops.flatMap((s) => [s.planned, s.actual]));

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <LegendSwatch color={colors.textFaint} label="Planned" />
        <LegendSwatch color={colors.primary} label="Actual" note="coloured by budget status" />
      </View>

      {stops.map((summary) => (
        <View key={summary.stop.id} style={styles.row}>
          <View style={styles.rowHead}>
            <Text style={styles.stopName} numberOfLines={1}>
              {summary.stop.name}
            </Text>
            <Text
              style={[
                styles.stopValue,
                summary.status === 'over' && styles.stopValueOver,
              ]}
            >
              {formatMoney(summary.actual, currency, { compact: true })}
            </Text>
          </View>

          <Svg width="100%" height={22}>
            {/* 2px gap between the pair keeps them readable as two marks. */}
            <Rect
              x={0}
              y={0}
              width={`${(summary.planned / max) * 100}%`}
              height={8}
              rx={4}
              fill={colors.border}
            />
            <Rect
              x={0}
              y={12}
              width={`${(summary.actual / max) * 100}%`}
              height={8}
              rx={4}
              fill={
                summary.status === 'unset'
                  ? colors.primary
                  : statusColor[summary.status]
              }
            />
          </Svg>

          <Text style={styles.rowMeta}>
            Planned {formatMoney(summary.planned, currency, { compact: true })}
            {summary.budget !== null
              ? ` · cap ${formatMoney(summary.budget, currency, { compact: true })}`
              : ' · no cap'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LegendSwatch({
  color,
  label,
  note,
}: {
  color: string;
  label: string;
  note?: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>
        {label}
        {note ? <Text style={styles.legendNote}> ({note})</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  legend: { gap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.textMuted },
  legendNote: { color: colors.textFaint },
  row: { gap: 2 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stopName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  stopValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  stopValueOver: { color: colors.over },
  rowMeta: { fontSize: 11, color: colors.textFaint },
});

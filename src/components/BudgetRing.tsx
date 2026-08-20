import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { progressRatio, statusFor } from '../budget/engine';
import { makeStyles, radius, statusColorOf, statusTextOf, useTheme } from '../theme';

/**
 * Small circular progress: spend against a budget, coloured by the same
 * thresholds as BudgetBar. Shows a percentage, or a dash when no budget is set.
 */
export function BudgetRing({
  actual,
  cap,
  size = 44,
  strokeWidth = 4,
}: {
  actual: number;
  cap: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const styles = useStyles();
  const t = useTheme();
  const status = statusFor(actual, cap);
  const ratio = progressRatio(actual, cap);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = cap === null || cap <= 0 ? null : Math.round((actual / cap) * 100);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={t.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {cap !== null && cap > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={statusColorOf(t, status)}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * ratio} ${circumference}`}
            strokeLinecap="round"
            fill="none"
            // Start the arc at 12 o'clock rather than 3.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>

      <Text style={[styles.label, percent !== null && { color: statusTextOf(t, status) }]}>
        {percent === null ? '—' : `${percent}%`}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  label: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
    color: t.textFaint,
  },
}));

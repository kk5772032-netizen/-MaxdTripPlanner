import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { formatMoney } from '../../budget/money';
import type { TripTotals } from '../../budget/engine';
import { makeStyles, spacing, type } from '../../theme';
import type { Trip } from '../../types';
import { BudgetBar } from '../BudgetBar';
import { Button, Card, Notice } from '../ui';

/**
 * Money, as one section of a trip rather than the spine of the app.
 *
 * This used to be everywhere at once: a sticky total pinned over every screen,
 * a tab on every stop, and three screens of its own. That made a planning tool
 * feel like an expense tracker. It now sits beside Itinerary, Map and Bookings
 * as a peer, and the detail lives one tap away rather than underfoot.
 */
export function BudgetSection({
  trip,
  totals,
  expenseCount,
  warning,
}: {
  trip: Trip;
  totals: TripTotals;
  expenseCount: number;
  warning: string | null;
}) {
  const styles = useStyles();
  const router = useRouter();

  const headline =
    totals.remainingBudget === null ? totals.totalActual : totals.remainingBudget;
  const over = totals.remainingBudget !== null && totals.remainingBudget < 0;

  return (
    <View style={styles.section}>
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>
          {totals.remainingBudget === null ? 'Total spent' : 'Remaining budget'}
        </Text>
        <Text style={[styles.heroValue, over && styles.heroValueOver]}>
          {formatMoney(headline, trip.currency, { compact: true })}
        </Text>

        <BudgetBar
          actual={totals.totalActual}
          cap={totals.totalBudget}
          planned={totals.totalPlanned}
          currency={trip.currency}
          style={styles.heroBar}
        />

        {warning ? <Notice tone="warning" body={warning} /> : null}
      </Card>

      <View style={styles.stats}>
        <Stat label="Budget" value={totals.totalBudget} currency={trip.currency} />
        <Stat label="Planned" value={totals.totalPlanned} currency={trip.currency} />
        <Stat label="Actual" value={totals.totalActual} currency={trip.currency} />
      </View>

      <Button
        title={expenseCount === 0 ? 'Log an expense' : `${expenseCount} expenses`}
        icon="receipt-outline"
        variant="secondary"
        onPress={() => router.push(`/trip/${trip.id}/expenses`)}
      />
      <Button
        title="Charts and breakdown"
        icon="stats-chart-outline"
        variant="secondary"
        onPress={() => router.push(`/trip/${trip.id}/dashboard`)}
      />
      <Button
        title="Trip recap"
        icon="sparkles-outline"
        variant="secondary"
        onPress={() => router.push(`/trip/${trip.id}/recap`)}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  currency,
}: {
  label: string;
  value: number | null;
  currency: string;
}) {
  const styles = useStyles();
  return (
    <Card style={styles.stat} raised={false}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value === null ? '—' : formatMoney(value, currency, { compact: true })}
      </Text>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  section: { gap: spacing.md },
  hero: { gap: spacing.sm },
  heroLabel: { ...type.label, color: t.textMuted },
  heroValue: { ...type.hero, color: t.text, fontVariant: ['tabular-nums'] },
  heroValueOver: { color: t.overText },
  heroBar: { marginTop: spacing.sm },

  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: 2 },
  statLabel: { ...type.captionStrong, color: t.textMuted },
  statValue: { ...type.heading, color: t.text, fontVariant: ['tabular-nums'] },
}));

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../budget/money';
import { balances, settle, type Traveller as Person } from '../../money/settle';
import { useTripStore } from '../../state/tripStore';
import { elevation, makeStyles, radius, spacing, type, useTheme } from '../../theme';
import type { Trip } from '../../types';
import { Button, Card, IconButton, Input, notifySuccess } from '../ui';

/**
 * Who owes whom.
 *
 * Nobody else needs this app for it to work. You record who was there and who
 * paid; the arithmetic happens here and the answer goes out as a message. That
 * is the whole feature — an invitation system would make it worse and would
 * need a server.
 */
export function SplitSection({ trip }: { trip: Trip }) {
  const styles = useStyles();
  const t = useTheme();
  const { travellers, expenses, addTraveller, removeTraveller } = useTripStore();
  const [name, setName] = useState('');

  const people: Person[] = travellers.map((p) => ({ id: p.id, name: p.name }));
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone';

  const { owed, transfers } = useMemo(() => {
    const owed = balances(people, expenses);
    return { owed, transfers: settle(owed) };
  }, [travellers, expenses]);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await addTraveller(trimmed);
    setName('');
    notifySuccess();
  };

  const shareSettleUp = () => {
    const lines = [
      `${trip.name} — who owes what`,
      '',
      ...transfers.map(
        (x) =>
          `${nameOf(x.fromId)} pays ${nameOf(x.toId)} ${formatMoney(
            x.amountMinor,
            trip.currency,
          )}`,
      ),
    ];
    void Share.share({ title: trip.name, message: lines.join('\n') }).catch(() => {});
  };

  return (
    <View style={styles.section}>
      <Card style={styles.form}>
        <Text style={styles.formLabel}>Who&apos;s on this trip</Text>
        <View style={styles.formRow}>
          <View style={styles.grow}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Meera"
              returnKeyType="done"
              onSubmitEditing={() => void add()}
              accessibilityLabel="Add someone to the trip"
            />
          </View>
          <Button title="Add" icon="add" onPress={() => void add()} disabled={!name.trim()} />
        </View>
        <Text style={styles.hint}>
          Just names. They don&apos;t need the app — you record what was spent and send
          them the total.
        </Text>
      </Card>

      {travellers.length === 0 ? null : (
        <View style={styles.list}>
          {travellers.map((person) => {
            const balance = owed.find((b) => b.travellerId === person.id);
            const net = balance?.netMinor ?? 0;
            return (
              <View key={person.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {person.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {person.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {balance && balance.paidMinor > 0
                      ? `paid ${formatMoney(balance.paidMinor, trip.currency, { compact: true })}`
                      : 'paid nothing yet'}
                  </Text>
                </View>

                {net !== 0 ? (
                  <Text style={[styles.net, net > 0 ? styles.netUp : styles.netDown]}>
                    {net > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(net), trip.currency, { compact: true })}
                  </Text>
                ) : null}

                <IconButton
                  icon="close"
                  label={`Remove ${person.name}`}
                  size={30}
                  onPress={() => void removeTraveller(person.id)}
                />
              </View>
            );
          })}
        </View>
      )}

      {travellers.length >= 2 ? (
        <Card style={styles.settle}>
          <Text style={styles.settleTitle}>Settling up</Text>

          {transfers.length === 0 ? (
            <View style={styles.square}>
              <Ionicons name="checkmark-circle" size={18} color={t.underText} />
              <Text style={styles.squareText}>
                {expenses.some((e) => e.paidBy)
                  ? 'Everyone is square.'
                  : 'Nobody has been marked as paying yet — set who paid on an expense.'}
              </Text>
            </View>
          ) : (
            <>
              {transfers.map((x) => (
                <View key={`${x.fromId}-${x.toId}`} style={styles.transfer}>
                  <Text style={styles.transferText} numberOfLines={1}>
                    <Text style={styles.transferName}>{nameOf(x.fromId)}</Text> pays{' '}
                    <Text style={styles.transferName}>{nameOf(x.toId)}</Text>
                  </Text>
                  <Text style={styles.transferAmount}>
                    {formatMoney(x.amountMinor, trip.currency, { compact: true })}
                  </Text>
                </View>
              ))}

              <Button
                title="Send this to them"
                icon="paper-plane-outline"
                variant="secondary"
                onPress={shareSettleUp}
              />
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: { gap: spacing.md },
  form: { gap: spacing.sm },
  formLabel: { ...type.label, color: t.textMuted },
  formRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  grow: { flex: 1 },
  hint: { ...type.caption, color: t.textFaint },

  list: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    overflow: 'hidden',
    ...elevation.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.primarySoft,
  },
  avatarText: { ...type.captionStrong, color: t.primary },
  rowText: { flex: 1, gap: 1 },
  rowName: { ...type.body, color: t.text },
  rowMeta: { ...type.caption, color: t.textFaint },
  net: { ...type.label, fontVariant: ['tabular-nums'] },
  netUp: { color: t.underText },
  netDown: { color: t.overText },

  settle: { gap: spacing.sm },
  settleTitle: { ...type.heading, color: t.text },
  square: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  squareText: { flex: 1, ...type.body, color: t.textMuted },
  transfer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  transferText: { flex: 1, ...type.body, color: t.textMuted },
  transferName: { color: t.text, fontWeight: '600' },
  transferAmount: { ...type.amount, color: t.text },
}));

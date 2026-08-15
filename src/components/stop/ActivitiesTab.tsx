import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoney, parseMoney, sumMinor } from '../../budget/money';
import { useTripStore } from '../../state/tripStore';
import { colors, radius, spacing } from '../../theme';
import type { Activity, Stop } from '../../types';
import { AmountInput } from '../AmountInput';
import { Button, Card, EmptyState, Input } from '../ui';

/** Checklist of things to do at a stop, each with an optional estimated cost. */
export function ActivitiesTab({
  stop,
  currency,
  activities,
}: {
  stop: Stop;
  currency: string;
  activities: Activity[];
}) {
  const { addActivity, updateActivity, removeActivity } = useTripStore();

  const [title, setTitle] = useState('');
  const [costText, setCostText] = useState('');
  const [saving, setSaving] = useState(false);

  const estimated = sumMinor(activities.map((a) => a.estimatedCostMinor));
  const doneCount = activities.filter((a) => a.done).length;

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addActivity({
        stopId: stop.id,
        title: title.trim(),
        estimatedCostMinor: parseMoney(costText, currency),
        done: false,
      });
      setTitle('');
      setCostText('');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (activity: Activity) => {
    Alert.alert('Remove activity?', `"${activity.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeActivity(activity.id),
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.form}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Walk to the war memorial"
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <View style={styles.formRow}>
          <AmountInput
            value={costText}
            onChangeText={setCostText}
            currency={currency}
            placeholder="Est. cost (optional)"
            style={styles.amount}
            accessibilityLabel="Estimated cost"
          />
          <Button title="Add" onPress={add} disabled={!title.trim() || saving} />
        </View>
      </Card>

      {activities.length === 0 ? (
        <EmptyState
          title="Nothing planned here yet"
          body="Add the things you want to do at this stop. Estimated costs roll up into the stop's planned spend."
        />
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {doneCount} of {activities.length} done
            </Text>
            <Text style={styles.summaryText}>
              Planned {formatMoney(estimated, currency, { compact: true })}
            </Text>
          </View>

          <View style={styles.list}>
            {activities.map((activity) => (
              <Pressable
                key={activity.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: activity.done }}
                accessibilityLabel={activity.title}
                onPress={() => void updateActivity(activity.id, { done: !activity.done })}
                onLongPress={() => confirmRemove(activity)}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <View style={[styles.checkbox, activity.done && styles.checkboxDone]}>
                  {activity.done ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text
                  style={[styles.itemTitle, activity.done && styles.itemTitleDone]}
                  numberOfLines={2}
                >
                  {activity.title}
                </Text>
                <Text style={styles.itemCost}>
                  {activity.estimatedCostMinor === null
                    ? ''
                    : formatMoney(activity.estimatedCostMinor, currency, { compact: true })}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>Tap to tick off, long-press to remove.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.md },
  formRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  amount: { flex: 1 },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemPressed: { backgroundColor: colors.bg },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.under, borderColor: colors.under },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  itemTitle: { flex: 1, fontSize: 15, color: colors.text },
  itemTitleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  itemCost: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
});

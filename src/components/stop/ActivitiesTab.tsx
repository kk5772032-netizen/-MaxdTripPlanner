import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoney, parseMoney, sumMinor } from '../../budget/money';
import { useTripStore } from '../../state/tripStore';
import { colors, elevation, radius, spacing, type } from '../../theme';
import type { Activity, Stop } from '../../types';
import { AmountInput } from '../AmountInput';
import { Button, Card, EmptyState, IconButton, Input, notifySuccess } from '../ui';

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
      notifySuccess();
    } finally {
      setSaving(false);
    }
  };

  const remove = (activity: Activity) => void removeActivity(activity.id);

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
          icon="checkbox-outline"
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
                onLongPress={() => remove(activity)}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <View style={[styles.checkbox, activity.done && styles.checkboxDone]}>
                  {activity.done ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : null}
                </View>
                <Text
                  style={[styles.itemTitle, activity.done && styles.itemTitleDone]}
                  numberOfLines={2}
                >
                  {activity.title}
                </Text>
                {activity.estimatedCostMinor !== null ? (
                  <Text style={styles.itemCost}>
                    {formatMoney(activity.estimatedCostMinor, currency, { compact: true })}
                  </Text>
                ) : null}
                <IconButton
                  icon="trash-outline"
                  label={`Remove ${activity.title}`}
                  tone="danger"
                  size={30}
                  onPress={() => remove(activity)}
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>Tap a row to tick it off.</Text>
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
  summaryText: { ...type.label, color: colors.textMuted },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemPressed: { backgroundColor: colors.bg },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.under, borderColor: colors.under },
  itemTitle: { flex: 1, ...type.body, color: colors.text },
  itemTitleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  itemCost: { ...type.label, color: colors.textMuted },
  hint: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
});

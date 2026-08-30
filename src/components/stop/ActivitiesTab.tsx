import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoney, parseMoney, sumMinor } from '../../budget/money';
import { addMinutes, formatDuration, formatTime, plannedMinutes } from '../../itinerary/schedule';
import { useTripStore } from '../../state/tripStore';
import { elevation, makeStyles, radius, spacing, type, useTheme } from '../../theme';
import type { Activity, Stop } from '../../types';
import { AmountInput } from '../AmountInput';
import { Checkbox } from '../Checkbox';
import { Button, Card, EmptyState, IconButton, Input, notifySuccess } from '../ui';
import { ActivityTiming } from './ActivityTiming';
import { NearbyThings } from './NearbyThings';

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
  const styles = useStyles();
  const { addActivity, updateActivity, removeActivity } = useTripStore();

  const [title, setTitle] = useState('');
  const [costText, setCostText] = useState('');
  const [saving, setSaving] = useState(false);
  /** Which row has its timing controls open. One at a time. */
  const [timingFor, setTimingFor] = useState<string | null>(null);

  const estimated = sumMinor(activities.map((a) => a.estimatedCostMinor));
  const doneCount = activities.filter((a) => a.done).length;
  const planned = formatDuration(plannedMinutes(activities));

  // The store appends new rows, so the clock order has to be applied here or a
  // 9am activity added last would sit below the 5pm one.
  const ordered = orderByClock(activities);

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

  const titles = new Set(activities.map((a) => a.title.trim().toLowerCase()));

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.form}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Walk to the war memorial"
          returnKeyType="done"
          onSubmitEditing={add}
          accessibilityLabel="Something to do here"
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

      <NearbyThings
        stop={stop}
        existingTitles={titles}
        onAdd={(place) => {
          void addActivity({
            stopId: stop.id,
            title: place.name,
            // Google has no idea what a ticket costs; the estimate is yours.
            estimatedCostMinor: null,
            done: false,
          });
          notifySuccess();
        }}
      />

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
              {/* No "₹0" when nobody estimated anything — a zero here reads as
                  a figure someone entered rather than an absence. */}
              {[planned, estimated > 0 ? formatMoney(estimated, currency, { compact: true }) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          <View style={styles.list}>
            {ordered.map((activity) => (
              <View key={activity.id}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: activity.done }}
                  accessibilityLabel={activity.title}
                  onPress={() => void updateActivity(activity.id, { done: !activity.done })}
                  onLongPress={() => remove(activity)}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <Checkbox checked={activity.done} />

                  <View style={styles.itemText}>
                    <Text
                      style={[styles.itemTitle, activity.done && styles.itemTitleDone]}
                      numberOfLines={2}
                    >
                      {activity.title}
                    </Text>
                    {when(activity) ? (
                      <Text style={styles.itemWhen}>{when(activity)}</Text>
                    ) : null}
                  </View>

                  {activity.estimatedCostMinor !== null ? (
                    <Text style={styles.itemCost}>
                      {formatMoney(activity.estimatedCostMinor, currency, { compact: true })}
                    </Text>
                  ) : null}

                  {/* Its own control rather than a tap on the row: the row
                      already means "tick this off", which is what you do to it
                      a hundred times more often than you re-time it. */}
                  <IconButton
                    icon={timingFor === activity.id ? 'chevron-up' : 'time-outline'}
                    label={
                      activity.startTime
                        ? `Change when ${activity.title} happens`
                        : `Set a time for ${activity.title}`
                    }
                    tone={activity.startTime ? 'primary' : 'muted'}
                    size={30}
                    onPress={() =>
                      setTimingFor((open) => (open === activity.id ? null : activity.id))
                    }
                  />
                  <IconButton
                    icon="trash-outline"
                    label={`Remove ${activity.title}`}
                    tone="danger"
                    size={30}
                    onPress={() => remove(activity)}
                  />
                </Pressable>

                {timingFor === activity.id ? (
                  <ActivityTiming
                    startTime={activity.startTime}
                    durationMin={activity.durationMin}
                    onChange={(patch) => void updateActivity(activity.id, patch)}
                  />
                ) : null}
              </View>
            ))}
          </View>

          <Text style={styles.hint}>
            Tap a row to tick it off. The clock icon puts it on the day.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

/** "10:00 am – 11:30 am", "10:00 am", "about 1h", or nothing. */
function when(activity: Activity): string | null {
  const start = formatTime(activity.startTime);
  if (!start) {
    const length = activity.durationMin ? formatDuration(activity.durationMin) : null;
    return length ? `about ${length}` : null;
  }
  if (!activity.durationMin) return start;
  return `${start} – ${formatTime(addMinutes(activity.startTime!, activity.durationMin))}`;
}

/** Timed first, on the clock; everything else keeps the order it was added in. */
function orderByClock(activities: Activity[]): Activity[] {
  return activities
    .map((activity, i) => ({ activity, i }))
    .sort((a, b) => {
      const at = a.activity.startTime;
      const bt = b.activity.startTime;
      if (at && bt && at !== bt) return at < bt ? -1 : 1;
      if (at && !bt) return -1;
      if (bt && !at) return 1;
      return a.i - b.i;
    })
    .map(({ activity }) => activity);
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.md },
  formRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  amount: { flex: 1 },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryText: { ...type.label, color: t.textMuted },
  list: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
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
    borderBottomColor: t.border,
  },
  itemPressed: { backgroundColor: t.bg },
  itemText: { flex: 1, gap: 1 },
  itemTitle: { ...type.body, color: t.text },
  itemWhen: { ...type.caption, color: t.textMuted, fontVariant: ['tabular-nums'] },
  itemTitleDone: { color: t.textFaint, textDecorationLine: 'line-through' },
  itemCost: { ...type.label, color: t.textMuted },
  hint: { ...type.caption, color: t.textFaint, textAlign: 'center' },
}));

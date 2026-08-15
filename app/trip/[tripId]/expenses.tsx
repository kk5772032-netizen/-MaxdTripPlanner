import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatMoney, parseMoney, toDecimalString } from '../../../src/budget/money';
import { AmountInput } from '../../../src/components/AmountInput';
import { DateField } from '../../../src/components/DateField';
import { ExpenseRow } from '../../../src/components/ExpenseRow';
import { Button, Card, EmptyState, Field, Input, Loading } from '../../../src/components/ui';
import { todayIso } from '../../../src/dates';
import { useTripStore } from '../../../src/state/tripStore';
import { categoryColors, categoryLabels, colors, radius, spacing } from '../../../src/theme';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '../../../src/types';

/**
 * The whole trip's expense log, filterable by stop and category.
 *
 * `?stopId=` pre-filters the list and pre-selects that stop in the add form,
 * so arriving from a stop's Budget tab lands somewhere useful.
 */
export default function ExpensesScreen() {
  const { tripId, stopId: initialStopId } = useLocalSearchParams<{
    tripId: string;
    stopId?: string;
  }>();

  const { trip, stops, expenses, loading, open, removeExpense } = useTripStore();
  const [ready, setReady] = useState(false);

  // 'all' = no filter, null = trip-level expenses only, otherwise a stop id.
  const [filterStop, setFilterStop] = useState<string | 'all' | null>(initialStopId ?? 'all');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void open(tripId).then(() => setReady(true));
    }, [tripId, open]),
  );

  const stopNames = useMemo(
    () => new Map(stops.map((s) => [s.id, s.name])),
    [stops],
  );

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        if (filterStop !== 'all' && e.stopId !== filterStop) return false;
        if (filterCategory !== 'all' && e.category !== filterCategory) return false;
        return true;
      }),
    [expenses, filterStop, filterCategory],
  );

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amountMinor, 0),
    [filtered],
  );

  const confirmDelete = (expense: Expense) => {
    Alert.alert('Delete expense?', 'This expense will be removed from the trip.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeExpense(expense.id) },
    ]);
  };

  if ((loading && !ready) || !trip) return <Loading />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Expenses',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditing(null);
                setFormOpen((open) => !open);
              }}
            >
              <Text style={styles.headerAction}>{formOpen ? 'Close' : 'Add'}</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {formOpen || editing ? (
          <ExpenseForm
            key={editing?.id ?? 'new'}
            currency={trip.currency}
            stops={stops.map((s) => ({ id: s.id, name: s.name }))}
            defaultStopId={editing ? editing.stopId : filterStop === 'all' ? null : filterStop}
            editing={editing}
            onDone={() => {
              setEditing(null);
              setFormOpen(false);
            }}
          />
        ) : null}

        <View style={styles.filters}>
          <FilterRow
            label="Stop"
            options={[
              { value: 'all', label: 'All' },
              { value: 'none', label: 'Whole trip' },
              ...stops.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={filterStop === null ? 'none' : filterStop}
            onChange={(value) => setFilterStop(value === 'none' ? null : value)}
          />
          <FilterRow
            label="Category"
            options={[
              { value: 'all', label: 'All' },
              ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: categoryLabels[c] })),
            ]}
            value={filterCategory}
            onChange={(value) => setFilterCategory(value as ExpenseCategory | 'all')}
          />
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'}
          </Text>
          <Text style={styles.totalValue}>
            {formatMoney(filteredTotal, trip.currency)}
          </Text>
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            title={expenses.length === 0 ? 'Nothing logged yet' : 'Nothing matches those filters'}
            body={
              expenses.length === 0
                ? 'Log what you actually spend as the trip happens — it shows up against each stop’s budget straight away.'
                : 'Try widening the stop or category filter.'
            }
            action={
              expenses.length === 0 ? (
                <Button title="Add an expense" onPress={() => setFormOpen(true)} />
              ) : undefined
            }
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                currency={trip.currency}
                stopName={expense.stopId ? stopNames.get(expense.stopId) ?? null : null}
                onPress={() => {
                  setFormOpen(false);
                  setEditing(expense);
                }}
                onLongPress={() => confirmDelete(expense)}
              />
            ))}
          </View>
        )}

        {filtered.length > 0 ? (
          <Text style={styles.hint}>Tap to edit, long-press to delete.</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ExpenseForm({
  currency,
  stops,
  defaultStopId,
  editing,
  onDone,
}: {
  currency: string;
  stops: { id: string; name: string }[];
  defaultStopId: string | null;
  editing: Expense | null;
  onDone: () => void;
}) {
  const { addExpense, updateExpense } = useTripStore();

  const [amountText, setAmountText] = useState(
    editing ? toDecimalString(editing.amountMinor, currency) : '',
  );
  const [category, setCategory] = useState<ExpenseCategory>(editing?.category ?? 'food');
  const [stopId, setStopId] = useState<string | null>(editing ? editing.stopId : defaultStopId);
  const [note, setNote] = useState(editing?.note ?? '');
  const [spentAt, setSpentAt] = useState(editing?.spentAt ?? todayIso());
  const [saving, setSaving] = useState(false);

  const amountMinor = parseMoney(amountText, currency);
  const canSave = amountMinor !== null && amountMinor > 0 && !saving;

  const save = async () => {
    if (!canSave || amountMinor === null) return;
    setSaving(true);
    try {
      const input = {
        stopId,
        category,
        amountMinor,
        note: note.trim() || null,
        spentAt,
      };
      if (editing) {
        await updateExpense(editing.id, input);
      } else {
        await addExpense(input);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.form}>
      <Field label={editing ? 'Edit expense' : 'New expense'}>
        <AmountInput
          value={amountText}
          onChangeText={setAmountText}
          currency={currency}
          autoFocus={!editing}
          accessibilityLabel="Amount"
        />
      </Field>

      <Field label="Category">
        <View style={styles.chips}>
          {EXPENSE_CATEGORIES.map((value) => {
            const active = value === category;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategory(value)}
                style={[
                  styles.chip,
                  active && { backgroundColor: categoryColors[value], borderColor: categoryColors[value] },
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {categoryLabels[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Stop" hint="Leave on “Whole trip” for flights, visas and anything not tied to one place.">
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: stopId === null }}
            onPress={() => setStopId(null)}
            style={[styles.chip, stopId === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, stopId === null && styles.chipTextPrimary]}>
              Whole trip
            </Text>
          </Pressable>
          {stops.map((stop) => {
            const active = stop.id === stopId;
            return (
              <Pressable
                key={stop.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setStopId(stop.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextPrimary]}
                  numberOfLines={1}
                >
                  {stop.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Date">
        <DateField value={spentAt} onChange={setSpentAt} />
      </Field>

      <Field label="Note" hint="Optional.">
        <Input value={note} onChangeText={setNote} placeholder="Lunch at Karim's" />
      </Field>

      <View style={styles.formActions}>
        <Button
          title={editing ? 'Save changes' : 'Add expense'}
          onPress={save}
          disabled={!canSave}
          loading={saving}
          style={styles.flexButton}
        />
        <Button title="Cancel" variant="secondary" onPress={onDone} style={styles.flexButton} />
      </View>
    </Card>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextPrimary]} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  headerAction: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  form: { gap: 0 },
  formActions: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1 },
  filters: { gap: spacing.md },
  filterRow: { gap: spacing.sm },
  filterLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: 180,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#fff' },
  chipTextPrimary: { color: colors.primary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  totalValue: { fontSize: 17, fontWeight: '700', color: colors.text },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hint: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
});

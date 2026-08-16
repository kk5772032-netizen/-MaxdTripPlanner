import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatMoney, parseMoney, toDecimalString } from '../../../src/budget/money';
import { confirmDestructive } from '../../../src/confirm';
import { AmountInput } from '../../../src/components/AmountInput';
import { DateField } from '../../../src/components/DateField';
import { ExpenseRow } from '../../../src/components/ExpenseRow';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  HeaderAction,
  Input,
  SkeletonList,
  notifySuccess,
} from '../../../src/components/ui';
import { todayIso } from '../../../src/dates';
import { useTripStore } from '../../../src/state/tripStore';
import {
  categoryColors,
  categoryIcons,
  categoryLabels,
  colors,
  elevation,
  radius,
  spacing,
  type,
} from '../../../src/theme';
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

  const confirmDelete = async (expense: Expense) => {
    const ok = await confirmDestructive({
      title: 'Delete expense?',
      message: 'This expense will be removed from the trip.',
    });
    if (ok) await removeExpense(expense.id);
  };

  if ((loading && !ready) || !trip) return <SkeletonList rows={3} />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Expenses',
          headerRight: () => (
            <HeaderAction
              label={formOpen ? 'Close' : 'Add'}
              icon={formOpen ? 'close' : 'add'}
              onPress={() => {
                setEditing(null);
                setFormOpen((open) => !open);
              }}
            />
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
            icon={expenses.length === 0 ? 'receipt-outline' : 'filter-outline'}
            title={expenses.length === 0 ? 'Nothing logged yet' : 'Nothing matches those filters'}
            body={
              expenses.length === 0
                ? 'Log what you actually spend as the trip happens — it shows up against each stop’s budget straight away.'
                : 'Try widening the stop or category filter.'
            }
            action={
              expenses.length === 0 ? (
                <Button title="Add an expense" icon="add" onPress={() => setFormOpen(true)} />
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
                onLongPress={() => void confirmDelete(expense)}
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
      notifySuccess();
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
          {EXPENSE_CATEGORIES.map((value) => (
            <Chip
              key={value}
              label={categoryLabels[value]}
              icon={categoryIcons[value] as never}
              color={categoryColors[value]}
              selected={value === category}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
      </Field>

      <Field label="Stop" hint="Leave on “Whole trip” for flights, visas and anything not tied to one place.">
        <View style={styles.chips}>
          <Chip
            label="Whole trip"
            icon="globe-outline"
            selected={stopId === null}
            onPress={() => setStopId(null)}
          />
          {stops.map((stop) => (
            <Chip
              key={stop.id}
              label={stop.name}
              icon="location-outline"
              selected={stop.id === stopId}
              onPress={() => setStopId(stop.id)}
            />
          ))}
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
          icon="checkmark"
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
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  // native-stack renders headerRight flush with the screen edge, so the inset
  // has to live on the element itself.

  form: { gap: 0 },
  formActions: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1 },
  filters: { gap: spacing.md },
  filterRow: { gap: spacing.sm },
  filterLabel: { ...type.label, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { ...type.label, color: colors.textMuted },
  totalValue: { ...type.title, color: colors.text },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.sm,
  },
  hint: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
});

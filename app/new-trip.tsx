import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SUPPORTED_CURRENCIES,
  currencySymbol,
  formatRate,
  parseRate,
  parseMoney,
  toDecimalString,
} from '../src/budget/money';
import { confirmDestructive } from '../src/confirm';
import { DateRangeField } from '../src/components/DateRangeField';
import { Button, Chip, Field, Input, notifySuccess } from '../src/components/ui';
import * as tripsRepo from '../src/db/repositories/trips';
import { NotificationPriming } from '../src/components/NotificationPriming';
import { useSettingsStore } from '../src/state/settingsStore';
import { useTripsStore } from '../src/state/tripsStore';
import { makeStyles, spacing, type } from '../src/theme';

/**
 * Create *and* edit — passing `?tripId=` switches it to edit mode. Same fields
 * either way, so a second screen would only be duplication.
 */
export default function NewTripScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const isEdit = !!tripId;

  const trips = useTripsStore((s) => s.trips);
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const notificationsAsked = useSettingsStore((s) => s.notificationsAsked);
  const [priming, setPriming] = useState(false);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);

  const create = useTripsStore((s) => s.create);
  const update = useTripsStore((s) => s.update);
  const remove = useTripsStore((s) => s.remove);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [homeCurrency, setHomeCurrency] = useState<string | null>(null);
  const [rateText, setRateText] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!tripId) return;
    void tripsRepo.getTrip(tripId).then((trip) => {
      if (!trip) return;
      setName(trip.name);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
      setCurrency(trip.currency);
      setHomeCurrency(trip.homeCurrency);
      setRateText(formatRate(trip.ratePpm));
      setBudgetText(toDecimalString(trip.totalBudgetMinor, trip.currency));
      setLoaded(true);
    });
  }, [tripId]);

  const canSave = name.trim().length > 0 && !saving && loaded;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const input = {
      name: name.trim(),
      startDate,
      endDate,
      currency,
      // A rate with nothing to convert into is meaningless, and vice versa, so
      // the pair lives or dies together.
      homeCurrency: homeCurrency && rateText.trim() ? homeCurrency : null,
      ratePpm: homeCurrency ? parseRate(rateText) : null,
      totalBudgetMinor: parseMoney(budgetText, currency),
    };
    try {
      if (tripId) {
        await update(tripId, input);
        notifySuccess();
        router.back();
      } else {
        const trip = await create(input);
        notifySuccess();
        // Ask about notifications once, here — after a trip exists, so the ask
        // has something concrete to be about. Never on launch.
        if (!notificationsAsked && trips.length === 0) {
          setCreatedTripId(trip.id);
          setPriming(true);
          return;
        }
        // Replace so Back from the trip lands on the list, not this form.
        router.replace(`/trip/${trip.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Trip name">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Delhi long weekend"
            autoFocus={!isEdit}
            returnKeyType="next"
          />
        </Field>

        <Field label="Dates">
          <DateRangeField
            start={startDate}
            end={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        </Field>

        <Field label="Currency">
          <View style={styles.currencyRow}>
            {SUPPORTED_CURRENCIES.map((code) => (
              <Chip
                key={code}
                label={code}
                accessibilityLabel={`Spend in ${code}`}
                selected={code === currency}
                onPress={() => setCurrency(code)}
              />
            ))}
          </View>
        </Field>

        <Field
          label="Also show amounts in"
          hint="Optional. For a trip you spend in one currency and think about in another."
        >
          <View style={styles.currencyRow}>
            <Chip
              label="Just one"
              accessibilityLabel="Show one currency only"
              selected={homeCurrency === null}
              onPress={() => setHomeCurrency(null)}
            />
            {SUPPORTED_CURRENCIES.filter((code) => code !== currency).map((code) => (
              <Chip
                key={code}
                label={code}
                accessibilityLabel={`Also show ${code}`}
                selected={code === homeCurrency}
                onPress={() => setHomeCurrency(code)}
              />
            ))}
          </View>
        </Field>

        {homeCurrency ? (
          <Field
            label={`1 ${currency} is worth`}
            hint="Look it up once. Rates move, but not enough to matter for planning."
          >
            <View style={styles.amountRow}>
              <Text style={styles.amountSymbol}>{currencySymbol(homeCurrency)}</Text>
              <Input
                value={rateText}
                onChangeText={setRateText}
                placeholder="2.34"
                keyboardType="decimal-pad"
                style={styles.amountInput}
                accessibilityLabel={`Exchange rate, ${homeCurrency} per ${currency}`}
              />
            </View>
          </Field>
        ) : null}

        <Field
          label="Total budget"
          hint="Optional. Leave empty to track spending without an overall cap."
        >
          <View style={styles.amountRow}>
            <Text style={styles.amountSymbol}>{currencySymbol(currency)}</Text>
            <Input
              value={budgetText}
              onChangeText={setBudgetText}
              placeholder="0"
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
        </Field>

        <Button
          title={isEdit ? 'Save changes' : 'Create trip'}
          icon={isEdit ? 'checkmark' : 'add'}
          onPress={save}
          disabled={!canSave}
          loading={saving}
        />

        {isEdit ? (
          <Button
            title="Delete trip"
            icon="trash-outline"
            variant="danger"
            style={styles.delete}
            onPress={async () => {
              const ok = await confirmDestructive({
                title: 'Delete trip?',
                message: `"${name}" and everything in it — stops, activities, food plans and expenses — will be removed.`,
              });
              if (!ok) return;
              await remove(tripId!);
              router.replace('/trips');
            }}
          />
        ) : null}
      </ScrollView>

      <NotificationPriming
        visible={priming}
        onClose={() => {
          setPriming(false);
          if (createdTripId) router.replace(`/trip/${createdTripId}`);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, backgroundColor: t.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amountSymbol: { ...type.heading, color: t.textMuted, minWidth: 20 },
  amountInput: { flex: 1 },
  delete: { marginTop: spacing.md },
}));

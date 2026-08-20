import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SUPPORTED_CURRENCIES, currencySymbol } from '../src/budget/money';
import { SettingsRow, SettingsSection } from '../src/components/SettingsRow';
import { Chip, Notice } from '../src/components/ui';
import { confirmDestructive } from '../src/confirm';
import { getDb } from '../src/db/client';
import * as settingsRepo from '../src/db/repositories/settings';
import { hasApiKey } from '../src/api/places';
import { cancelAll } from '../src/notifications';
import { useSettingsStore } from '../src/state/settingsStore';
import { useToastStore } from '../src/state/toastStore';
import { useTripsStore } from '../src/state/tripsStore';
import { colors, spacing, type } from '../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const s = useSettingsStore();
  const loadTrips = useTripsStore((t) => t.load);
  const showToast = useToastStore((t) => t.show);

  const [cacheRows, setCacheRows] = useState<number | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const readCacheSize = useCallback(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number; bytes: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(payload)), 0) AS bytes FROM places_cache`,
    );
    setCacheRows(row?.bytes ?? 0);
  }, []);

  useEffect(() => {
    void readCacheSize();
  }, [readCacheSize]);

  const clearCache = async () => {
    const db = await getDb();
    await db.runAsync('DELETE FROM places_cache');
    await readCacheSize();
    showToast({ message: 'Cached place data cleared' });
  };

  const deleteEverything = async () => {
    const ok = await confirmDestructive({
      title: 'Delete all data?',
      message: "Every trip, stop and expense on this device will be removed. This can't be undone.",
      confirmLabel: 'Delete everything',
    });
    if (!ok) return;
    await settingsRepo.deleteAllData();
    await cancelAll();
    await loadTrips();
    await readCacheSize();
    router.replace('/trips');
    showToast({ message: 'All data deleted' });
  };

  const cacheLabel =
    cacheRows === null ? '—' : cacheRows < 1024 ? `${cacheRows} B`
      : cacheRows < 1024 * 1024 ? `${(cacheRows / 1024).toFixed(0)} KB`
      : `${(cacheRows / 1024 / 1024).toFixed(1)} MB`;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SettingsSection title="Defaults">
        <SettingsRow
          icon="wallet-outline"
          label="Currency"
          sub="Pre-selected on a new trip"
          value={`${s.defaultCurrency} ${currencySymbol(s.defaultCurrency).trim()}`}
          onPress={() => setCurrencyOpen((o) => !o)}
        />
        {currencyOpen ? (
          <View style={styles.chips}>
            {SUPPORTED_CURRENCIES.map((code) => (
              <Chip
                key={code}
                label={code}
                selected={code === s.defaultCurrency}
                onPress={() => void s.set('defaultCurrency', code)}
              />
            ))}
          </View>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          icon="notifications-outline"
          label="Budget alerts"
          sub="When a stop or the trip nears its cap"
          toggled={s.budgetAlerts}
          onToggle={(v) => void s.set('budgetAlerts', v)}
        />
        <SettingsRow
          icon="time-outline"
          label="Daily expense reminder"
          sub={`Every day at ${s.dailyReminderTime} while a trip is running`}
          toggled={s.dailyReminder}
          onToggle={(v) => void s.set('dailyReminder', v)}
        />
        <SettingsRow
          icon="options-outline"
          label="All notification settings"
          onPress={() => router.push('/notification-settings')}
        />
      </SettingsSection>

      <SettingsSection title="Place search">
        <SettingsRow
          icon={hasApiKey() ? 'checkmark-circle' : 'alert-circle-outline'}
          label={hasApiKey() ? 'Places API connected' : 'No API key set'}
          sub={hasApiKey() ? undefined : 'Stops can still be added by typing them'}
        />
        <SettingsRow
          icon="server-outline"
          label="Cached place data"
          sub="Reused for 30 days to keep the Places bill down"
          value={cacheLabel}
          action={{ label: 'Clear', onPress: () => void clearCache() }}
        />
      </SettingsSection>

      <SettingsSection title="Your data">
        <SettingsRow
          icon="trash-outline"
          label="Delete all data"
          danger
          onPress={() => void deleteEverything()}
        />
      </SettingsSection>

      <Notice
        tone="info"
        icon="lock-closed-outline"
        body="Waypoint 1.0.0 — everything is stored on this device. No account, no sync."
      />
      <Text style={styles.footer}>Uninstalling the app deletes your trips.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg, paddingTop: 0 },
  footer: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
});

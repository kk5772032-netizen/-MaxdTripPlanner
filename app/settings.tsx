import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { mergeBackup, pickBackup, restoreBackup, shareBackup } from '../src/backup/backup';
import type { Backup } from '../src/backup/format';
import { SUPPORTED_CURRENCIES, currencySymbol } from '../src/budget/money';
import { SettingsRow, SettingsSection } from '../src/components/SettingsRow';
import { Chip, Notice, SegmentedControl, Sheet, SheetOption } from '../src/components/ui';
import { confirmDestructive } from '../src/confirm';
import { getDb } from '../src/db/client';
import * as settingsRepo from '../src/db/repositories/settings';
import { hasApiKey } from '../src/api/places';
import { cancelAll } from '../src/notifications';
import { useSettingsStore } from '../src/state/settingsStore';
import { useToastStore } from '../src/state/toastStore';
import { useTripsStore } from '../src/state/tripsStore';
import { makeStyles, spacing, type, useTheme } from '../src/theme';

export default function SettingsScreen() {
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();
  const s = useSettingsStore();
  const loadTrips = useTripsStore((t) => t.load);
  const showToast = useToastStore((t) => t.show);

  const [cacheRows, setCacheRows] = useState<number | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** A parsed, valid backup waiting for the user to say yes. */
  const [pendingRestore, setPendingRestore] = useState<Backup | null>(null);

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

  const backUp = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await shareBackup();
      if (result.ok) {
        const { trips } = result.counts;
        showToast({ message: `Backed up ${trips} ${trips === 1 ? 'trip' : 'trips'}` });
      } else if (result.reason) {
        showToast({ message: result.reason });
      }
    } finally {
      setBusy(false);
    }
  };

  // Two steps on purpose: picking a file is harmless, replacing everything you
  // have is not, and the confirmation can only say what is in the file once the
  // file has been read.
  const chooseRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await pickBackup();
      if (result.ok) setPendingRestore(result.backup);
      else if (result.reason) showToast({ message: result.reason });
    } finally {
      setBusy(false);
    }
  };

  const finish = async (message: string) => {
    setPendingRestore(null);
    await loadTrips();
    await readCacheSize();
    router.replace('/trips');
    showToast({ message });
  };

  /** Combines the file with what is here. The safe one, and the default. */
  const confirmMerge = async () => {
    if (!pendingRestore) return;
    setBusy(true);
    try {
      const stats = await mergeBackup(pendingRestore);
      const added = stats.added + stats.incoming;
      await finish(
        added === 0 && stats.deleted === 0
          ? 'Already up to date'
          : `Merged ${added} ${added === 1 ? 'change' : 'changes'}`,
      );
    } catch (e) {
      console.warn('[settings] merge failed', e);
      showToast({ message: "That backup couldn't be merged. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  };

  const confirmReplace = async () => {
    if (!pendingRestore) return;
    setBusy(true);
    try {
      const counts = await restoreBackup(pendingRestore);
      await finish(`Replaced with ${counts.trips} ${counts.trips === 1 ? 'trip' : 'trips'}`);
    } catch (e) {
      console.warn('[settings] restore failed', e);
      showToast({ message: "That backup couldn't be restored. Nothing was changed." });
    } finally {
      setBusy(false);
    }
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

      <SettingsSection title="Appearance">
        <View style={styles.themeRow}>
          <SegmentedControl
            value={s.theme}
            onChange={(v) => void s.set('theme', v)}
            options={[
              { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
              { value: 'light', label: 'Light', icon: 'sunny-outline' },
              { value: 'dark', label: 'Dark', icon: 'moon-outline' },
            ]}
          />
        </View>
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
          icon="navigate-circle-outline"
          label="Travel times between stops"
          sub="Cached for 30 days — one request per pair of places, on a paid API."
          toggled={s.travelTimes}
          onToggle={(next) => void s.set('travelTimes', next)}
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
          icon="download-outline"
          label="Back up your trips"
          value="One file"
          onPress={() => void backUp()}
        />
        <SettingsRow
          icon="cloud-upload-outline"
          label="Open a backup file"
          sub="Merge it with what's here, or replace everything"
          onPress={() => void chooseRestore()}
        />
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
      <Text style={styles.footer}>
        Uninstalling the app deletes your trips. Back up first.
      </Text>

      <Sheet
        visible={pendingRestore !== null}
        title="What should this file do?"
        subtitle={describe(pendingRestore)}
        onClose={() => setPendingRestore(null)}
      >
        {/* Merge first and by name, because replace is the one that can lose
            something and nobody reads a warning under a button they wanted. */}
        <SheetOption
          icon="git-merge-outline"
          title="Merge with what's here"
          body="Keeps both. Newer edits win, and anything deleted stays deleted."
          disabled={busy}
          onPress={() => void confirmMerge()}
        />
        <SheetOption
          icon="swap-horizontal-outline"
          title="Replace everything"
          body="Throws away what's on this device and uses the file instead."
          disabled={busy}
          onPress={() => void confirmReplace()}
        />
      </Sheet>
    </ScrollView>
  );
}

/** What is actually in the file, so "replace everything" is an informed yes. */
function describe(backup: Backup | null): string {
  if (!backup) return '';
  const parts = [
    `${backup.trips.length} ${backup.trips.length === 1 ? 'trip' : 'trips'}`,
    backup.stops.length ? `${backup.stops.length} stops` : null,
    backup.bookings.length ? `${backup.bookings.length} bookings` : null,
    backup.expenses.length ? `${backup.expenses.length} expenses` : null,
  ].filter(Boolean);
  const when = backup.exportedAt ? `, saved ${backup.exportedAt.slice(0, 10)}` : '';
  return `${parts.join(' · ')}${when}`;
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg, paddingTop: 0 },
  themeRow: { padding: spacing.lg },
  footer: { ...type.caption, color: t.textFaint, textAlign: 'center' },
}));

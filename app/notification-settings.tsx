import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SettingsRow, SettingsSection } from '../src/components/SettingsRow';
import { Notice, SegmentedControl } from '../src/components/ui';
import {
  cancelAll,
  hasNotificationPermission,
  requestNotificationPermission,
} from '../src/notifications';
import { useSettingsStore } from '../src/state/settingsStore';
import { spacing } from '../src/theme';

const TIMES = ['18:00', '20:00', '21:00'] as const;

export default function NotificationSettingsScreen() {
  const s = useSettingsStore();
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void hasNotificationPermission().then(setGranted);
  }, []);

  /** Turning the master switch on is also where permission gets asked for. */
  const toggleMaster = async (next: boolean) => {
    if (next && granted === false) {
      const ok = await requestNotificationPermission();
      setGranted(ok);
      if (!ok) return;
    }
    await s.set('budgetAlerts', next);
    if (!next && !s.dailyReminder && !s.tripStartingSoon) await cancelAll();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {granted === false ? (
        <Notice
          tone="warning"
          title="Notifications are off for Waypoint"
          body="Turn them on in your phone's settings, then switch the alerts you want back on here."
        />
      ) : (
        <Notice
          tone="info"
          icon="lock-closed-outline"
          body="Waypoint only notifies you about your own budgets. Nothing is sent anywhere."
        />
      )}

      <SettingsSection title="Budget alerts">
        <SettingsRow
          icon="notifications-outline"
          label="Budget alerts"
          toggled={s.budgetAlerts}
          onToggle={(v) => void toggleMaster(v)}
        />
        <View style={[styles.inset, !s.budgetAlerts && styles.dimmed]}>
          <SegmentedControl
            value={s.alertAt}
            onChange={(v) => void s.set('alertAt', v)}
            options={[
              { value: '80', label: '80%' },
              { value: '100', label: '100%' },
              { value: 'both', label: 'Both' },
            ]}
          />
        </View>
        <SettingsRow
          icon="location-outline"
          label="Per-stop alerts"
          sub="When one stop passes its own cap"
          toggled={s.perStopAlerts}
          onToggle={(v) => void s.set('perStopAlerts', v)}
          disabled={!s.budgetAlerts}
        />
        <SettingsRow
          icon="map-outline"
          label="Trip total alerts"
          sub="When the whole trip passes its budget"
          toggled={s.tripTotalAlerts}
          onToggle={(v) => void s.set('tripTotalAlerts', v)}
          disabled={!s.budgetAlerts}
        />
      </SettingsSection>

      <SettingsSection title="Reminders">
        <SettingsRow
          icon="time-outline"
          label="Daily expense reminder"
          sub="A nudge to log what you spent"
          toggled={s.dailyReminder}
          onToggle={(v) => void s.set('dailyReminder', v)}
        />
        <View style={[styles.inset, !s.dailyReminder && styles.dimmed]}>
          <SegmentedControl
            value={s.dailyReminderTime}
            onChange={(v) => void s.set('dailyReminderTime', v)}
            options={TIMES.map((t) => ({ value: t, label: label12h(t) }))}
          />
        </View>
        <SettingsRow
          icon="calendar-outline"
          label="Trip starting soon"
          sub="The evening before your start date"
          toggled={s.tripStartingSoon}
          onToggle={(v) => void s.set('tripStartingSoon', v)}
        />
      </SettingsSection>

      <SettingsSection title="Quiet">
        <SettingsRow
          icon="moon-outline"
          label="Only while a trip is running"
          sub="No notifications between trips"
          toggled={s.onlyWhileTravelling}
          onToggle={(v) => void s.set('onlyWhileTravelling', v)}
        />
      </SettingsSection>
    </ScrollView>
  );
}

function label12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  inset: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  // Disabled sub-rows dim rather than disappear, so the structure stays stable.
  dimmed: { opacity: 0.45 },
});

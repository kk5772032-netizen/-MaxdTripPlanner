import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestNotificationPermission } from '../notifications';
import { useSettingsStore } from '../state/settingsStore';
import { colors, elevation, radius, spacing, type } from '../theme';
import { Button } from './ui';

/**
 * Asks before the OS dialog does.
 *
 * Shown once, after the first trip exists — never on launch. A system prompt
 * with no context gets denied, and on iOS a denial is permanent, so the ask has
 * to earn itself first. "Not now" is a real button, not grey small print.
 */
export function NotificationPriming({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const setSetting = useSettingsStore((s) => s.set);

  const dismiss = async (enable: boolean) => {
    await setSetting('notificationsAsked', true);
    if (enable) {
      const granted = await requestNotificationPermission();
      await setSetting('budgetAlerts', granted);
      await setSetting('dailyReminder', granted);
    } else {
      // Declining here turns the features off rather than leaving them on and
      // silently failing at the OS layer.
      await setSetting('budgetAlerts', false);
      await setSetting('dailyReminder', false);
      await setSetting('tripStartingSoon', false);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, elevation.lg, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.badge}>
            <Ionicons name="notifications-outline" size={26} color={colors.primary} />
          </View>

          <Text style={styles.title}>Know before you overspend</Text>
          <Text style={styles.body}>
            Waypoint can tell you when a stop passes 80% of its budget, and remind you to log what
            you spent at the end of each day. Nothing else.
          </Text>

          <View style={styles.rows}>
            <Row icon="alert-circle-outline" label="Budget alerts" sub="When a stop or the trip nears its cap" />
            <Row icon="time-outline" label="Daily reminder" sub="One nudge each evening while you're away" />
            <Row icon="lock-closed-outline" label="Nothing leaves your phone" sub="No account, no tracking" />
          </View>

          <Button title="Turn on alerts" icon="notifications" onPress={() => void dismiss(true)} />
          <Button title="Not now" variant="ghost" onPress={() => void dismiss(false)} />
        </View>
      </View>
    </Modal>
  );
}

function Row({
  icon,
  label,
  sub,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  badge: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.textMuted },
  rows: { gap: 14, marginVertical: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowIcon: { marginTop: 1 },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { ...type.bodyStrong, color: colors.text },
  rowSub: { ...type.caption, color: colors.textMuted },
});

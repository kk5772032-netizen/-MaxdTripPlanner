import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';

import { SettingsRow, SettingsSection } from '../src/components/SettingsRow';
import { Button, Card, Field, Input, Notice } from '../src/components/ui';
import { confirmDestructive } from '../src/confirm';
import { useToastStore } from '../src/state/toastStore';
import { useTripsStore } from '../src/state/tripsStore';
import {
  formatSyncCode,
  newSyncCode,
  parseSyncCode,
  readLastSync,
  readSyncSettings,
  syncNow,
  writeSyncSettings,
} from '../src/sync/remote';
import { makeStyles, spacing, type } from '../src/theme';

/**
 * Sync, and collaboration, which turn out to be the same screen.
 *
 * A sync code is not an account. It is a shared secret that names a blob on a
 * server, and whoever has it holds the trip — so the screen says that out loud
 * rather than implying a login that does not exist.
 *
 * All of it is optional. The app works with nothing set up here; a backup file
 * passed by hand still does the same job offline.
 */
export default function SyncScreen() {
  const styles = useStyles();
  const router = useRouter();
  const showToast = useToastStore((t) => t.show);
  const loadTrips = useTripsStore((t) => t.load);

  const [url, setUrl] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [entered, setEntered] = useState('');
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const settings = await readSyncSettings();
    setUrl(settings.url ?? '');
    setCode(settings.code);
    setLastAt(await readLastSync());
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cleanUrl = url.trim().replace(/\/+$/, '');
  const usable = /^https?:\/\/\S+$/.test(cleanUrl);

  const start = async () => {
    await writeSyncSettings({ url: cleanUrl, code: newSyncCode() });
    await refresh();
    showToast({ message: 'Sync set up on this device' });
  };

  const join = async () => {
    const parsed = parseSyncCode(entered);
    if (!parsed) {
      showToast({ message: "That doesn't look like a sync code." });
      return;
    }
    await writeSyncSettings({ url: cleanUrl, code: parsed });
    setEntered('');
    setJoining(false);
    await refresh();
    // Joining without syncing leaves the screen looking connected and the trip
    // list empty, which reads as a failure. Fetch straight away.
    await run();
  };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await syncNow();
      if (!outcome.ok) {
        showToast({ message: outcome.reason });
      } else {
        await loadTrips();
        showToast({
          message:
            outcome.pulled === 0
              ? 'Up to date'
              : `Brought in ${outcome.pulled} ${outcome.pulled === 1 ? 'change' : 'changes'}`,
        });
      }
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const shareCode = () => {
    if (!code) return;
    void Share.share({
      message: `Join my Waypoint trip.\n\nServer: ${cleanUrl}\nCode: ${formatSyncCode(code)}`,
    }).catch(() => {});
  };

  const turnOff = async () => {
    const ok = await confirmDestructive({
      title: 'Turn off sync?',
      message:
        'This device keeps everything it has. It just stops sending and receiving changes.',
      confirmLabel: 'Turn off',
    });
    if (!ok) return;
    await writeSyncSettings({ url: null, code: null });
    await refresh();
    showToast({ message: 'Sync turned off' });
  };

  if (!loaded) return <View style={styles.content} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Notice
        tone="info"
        icon="git-compare-outline"
        title="Two devices, one trip"
        body="Both devices keep their own copy and send changes through a small server you run. Nothing is lost if the server is down — it catches up next time."
      />

      {code ? (
        <>
          <SettingsSection title="This trip's code">
            <SettingsRow
              icon="key-outline"
              label={formatSyncCode(code)}
              sub="Anyone with this code and the server address can read and change your trips."
              action={{ label: 'Share', onPress: shareCode }}
            />
            <SettingsRow icon="server-outline" label="Server" sub={cleanUrl} />
            <SettingsRow
              icon="time-outline"
              label="Last synced"
              value={lastAt ? relative(lastAt) : 'Never'}
            />
          </SettingsSection>

          <Button
            title="Sync now"
            icon="sync-outline"
            loading={busy}
            onPress={() => void run()}
          />

          <SettingsSection title="Stop">
            <SettingsRow
              icon="cloud-offline-outline"
              label="Turn off sync"
              danger
              onPress={() => void turnOff()}
            />
          </SettingsSection>
        </>
      ) : (
        <>
          <Card style={styles.form}>
            <Field
              label="Sync server"
              hint="Your own — the app ships the code for one in worker/. There is no server run by anybody else."
            >
              <Input
                value={url}
                onChangeText={setUrl}
                placeholder="https://waypoint-sync.yourname.workers.dev"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Sync server address"
              />
            </Field>

            {joining ? (
              <Field label="Sync code" hint="From the other device, dashes and all.">
                <Input
                  value={entered}
                  onChangeText={setEntered}
                  placeholder="k3f9x-2m1pq-…"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Sync code from the other device"
                />
              </Field>
            ) : null}

            <View style={styles.actions}>
              {joining ? (
                <>
                  <Button
                    title="Join"
                    icon="enter-outline"
                    disabled={!usable || !entered.trim()}
                    onPress={() => void join()}
                  />
                  <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => {
                      setEntered('');
                      setJoining(false);
                    }}
                  />
                </>
              ) : (
                <>
                  <Button
                    title="Start here"
                    icon="add-circle-outline"
                    disabled={!usable}
                    onPress={() => void start()}
                  />
                  <Button
                    title="I have a code"
                    variant="secondary"
                    icon="key-outline"
                    disabled={!usable}
                    onPress={() => setJoining(true)}
                  />
                </>
              )}
            </View>
          </Card>

          <Text style={styles.footer}>
            Start on the device that already has your trips, then use its code on the
            other one. Doing it the other way round works too — nothing is overwritten.
          </Text>
        </>
      )}

      <SettingsSection title="Without a server">
        <SettingsRow
          icon="document-outline"
          label="Back up and open a file instead"
          sub="The same merge, passed by hand. Works offline."
          onPress={() => router.push('/settings')}
        />
      </SettingsSection>
    </ScrollView>
  );
}

/** "4 minutes ago", not a timestamp nobody reads. */
function relative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'Never';
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  form: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  footer: { ...type.caption, color: t.textFaint, textAlign: 'center' },
}));

import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { prune } from '../src/api/placesCache';
import { installNotificationHandler } from '../src/notifications';
import { useSettingsStore } from '../src/state/settingsStore';
import { ToastHost } from '../src/components/ToastHost';
import { Button, Loading } from '../src/components/ui';
import { getDb } from '../src/db/client';
import { colors, elevation, spacing, type } from '../src/theme';

export default function RootLayout() {
  // Nothing renders until the schema exists — every screen reads from SQLite on
  // mount and an unmigrated database would just produce "no such table".
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadSettings = useSettingsStore((s) => s.load);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const onboarded = useSettingsStore((s) => s.onboarded);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    setDbState('loading');
    getDb()
      .then(() => {
        if (cancelled) return;
        setDbState('ready');
        installNotificationHandler();
        void loadSettings();
        // Housekeeping, not correctness — `read` already treats expired rows as
        // misses. Fire and forget so it never delays the first screen.
        void prune().catch(() => {});
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.warn('[db] open failed', e);
        setError(
          'Waypoint could not open its local database. Restarting the app usually fixes this.',
        );
        setDbState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, loadSettings]);

  // Wait for settings before deciding on onboarding — routing to /trips and
  // then bouncing to /onboarding a frame later is a visible flash.
  if (dbState === 'ready' && !settingsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <Loading />
        </View>
      </SafeAreaProvider>
    );
  }

  if (dbState !== 'ready') {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          {dbState === 'loading' ? (
            <Loading label="Opening your trips…" />
          ) : (
            <>
              <Text style={styles.errorTitle}>Couldn&apos;t open the database</Text>
              <Text style={styles.errorBody}>{error}</Text>
              <Button
                title="Try again"
                icon="refresh"
                variant="secondary"
                style={styles.retry}
                onPress={() => setAttempt((n) => n + 1)}
              />
            </>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!onboarded && pathname !== '/onboarding' ? <Redirect href="/onboarding" /> : null}
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface, ...elevation.none },
            headerShadowVisible: false,
            headerTintColor: colors.primary,
            headerTitleStyle: { ...type.heading, color: colors.text },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="new-trip"
            options={{ title: 'New trip', presentation: 'modal' }}
          />
          <Stack.Screen name="trip/[tripId]/index" options={{ title: 'Trip' }} />
          <Stack.Screen name="trip/[tripId]/new-place" options={{ title: 'Add stop' }} />
          <Stack.Screen name="trip/[tripId]/place/[placeId]" options={{ title: 'Stop' }} />
          <Stack.Screen name="trip/[tripId]/expenses" options={{ title: 'Expenses' }} />
          <Stack.Screen name="trip/[tripId]/dashboard" options={{ title: 'Dashboard' }} />
          <Stack.Screen name="trip/[tripId]/recap" options={{ title: 'Trip recap' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen
            name="notification-settings"
            options={{ title: 'Notifications' }}
          />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  errorTitle: { ...type.heading, color: colors.text, marginBottom: spacing.sm },
  errorBody: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  retry: { marginTop: spacing.xl, alignSelf: 'stretch' },
});

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDb } from '../src/db/client';
import { colors, spacing } from '../src/theme';

export default function RootLayout() {
  // Nothing renders until the schema exists — every screen reads from SQLite on
  // mount and an unmigrated database would just produce "no such table".
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then(() => {
        if (!cancelled) setDbState('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setDbState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (dbState !== 'ready') {
    return (
      <View style={styles.center}>
        {dbState === 'loading' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={styles.errorTitle}>Couldn&apos;t open the database</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="new-trip" options={{ title: 'New trip', presentation: 'modal' }} />
          <Stack.Screen name="trip/[tripId]/index" options={{ title: 'Trip' }} />
          <Stack.Screen name="trip/[tripId]/new-place" options={{ title: 'Add stop' }} />
          <Stack.Screen name="trip/[tripId]/place/[placeId]" options={{ title: 'Stop' }} />
          <Stack.Screen name="trip/[tripId]/expenses" options={{ title: 'Expenses' }} />
          <Stack.Screen name="trip/[tripId]/dashboard" options={{ title: 'Dashboard' }} />
        </Stack>
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
  errorTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  errorBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});

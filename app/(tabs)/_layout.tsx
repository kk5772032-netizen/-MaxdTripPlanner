import { Tabs } from 'expo-router';

import { colors } from '../../src/theme';

/**
 * A single tab today. The tab group exists because the trip list is the app's
 * home and later phases (saved places, settings) slot in beside it without
 * moving routes around.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

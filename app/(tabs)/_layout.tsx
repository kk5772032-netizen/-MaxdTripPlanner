import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';

import { HeaderAction } from '../../src/components/ui';

import { colors, elevation, type } from '../../src/theme';

/**
 * A single tab today. The group exists because the trip list is the app's home
 * and later additions (saved places, settings) slot in beside it without
 * moving routes around.
 */
export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: type.captionStrong,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.surface, ...elevation.none },
        headerShadowVisible: false,
        headerTitleStyle: { ...type.title, color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          headerRight: () => (
            <HeaderAction
              label="Settings"
              icon="settings-outline"
              onPress={() => router.push('/settings')}
            />
          ),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

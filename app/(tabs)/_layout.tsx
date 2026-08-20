import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';

import { HeaderAction } from '../../src/components/ui';

import { elevation, type, useTheme } from '../../src/theme';

/**
 * A single tab today. The group exists because the trip list is the app's home
 * and later additions (saved places, settings) slot in beside it without
 * moving routes around.
 */
export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textFaint,
        tabBarLabelStyle: type.captionStrong,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.border,
        },
        headerStyle: { backgroundColor: t.surface },
        headerShadowVisible: false,
        headerTitleStyle: { ...type.title, color: t.text },
        sceneStyle: { backgroundColor: t.bg },
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

import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';

import { HeaderAction } from '../../src/components/ui';

import { elevation, type, useTheme } from '../../src/theme';

/**
 * Two tabs: what is happening now, and everything you have planned.
 *
 * Today is first and is the app's home, because during a trip it is the only
 * screen worth opening — the trip list is where you go to plan, which is a
 * different mood and a rarer one.
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
        name="index"
        options={{
          title: 'Today',
          headerRight: () => (
            <HeaderAction
              label="Settings"
              icon="settings-outline"
              onPress={() => router.push('/settings')}
            />
          ),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'today' : 'today-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
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
    </Tabs>
  );
}

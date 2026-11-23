import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { COLORS } from '@/constants/colors';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(filled: IconName, outline: IconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: tabIcon('qr-code', 'qr-code-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('time', 'time-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person', 'person-outline') }} />
      <Tabs.Screen name="teacher" options={{ title: 'Teacher', tabBarIcon: tabIcon('clipboard', 'clipboard-outline') }} />
    </Tabs>
  );
}
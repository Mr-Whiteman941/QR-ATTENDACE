import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'class-reminders';

export type ReminderSession = {
  id: string;
  title: string;
  startsAt: Date;
};

/** Show notifications even while the app is open. */
export function setupNotifications() {
  if (Platform.OS === 'web') return; // notifications are not supported on web
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Class reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Used by app/_layout.tsx once the user is logged in. */
export async function setupReminders(): Promise<void> {
  setupNotifications();
  await requestReminderPermission();
}

/**
 * Used by lib/events.ts. Uses a fixed identifier per session, so calling it
 * again for the same session replaces the old reminder instead of duplicating.
 */
export async function scheduleSessionReminder(
  session: ReminderSession,
  minutesBefore = 10
): Promise<string | null> {
  const when = new Date(session.startsAt.getTime() - minutesBefore * 60000);
  if (when.getTime() <= Date.now()) return null;
  if (!(await requestReminderPermission())) return null;

  return Notifications.scheduleNotificationAsync({
    identifier: `session-${session.id}`,
    content: {
      title: `${session.title} starts soon`,
      body: `Starts in ${minutesBefore} minutes. Don't forget the QR attendance!`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: CHANNEL_ID,
    },
  });
}

export function cancelSessionReminder(sessionId: string) {
  return Notifications.cancelScheduledNotificationAsync(`session-${sessionId}`);
}
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { statusFor } from './budget/engine';
import { formatMoney } from './budget/money';
import { todayIso } from './dates';
import type { Settings } from './state/settingsStore';
import type { Trip } from './types';

/**
 * Budget alerts and reminders.
 *
 * Everything here is scheduled locally — there is no server, no push token and
 * nothing leaves the device. The copy is deliberate: every notification carries
 * a real figure (one without a number gets swiped away), and none of them
 * scold. "You're ₹840 over" is a fact; "You've overspent again!" is not.
 */

const CHANNEL = 'waypoint-budget';

/** Identifier prefixes, so a reschedule can cancel just its own kind. */
const ID = {
  stopAlert: 'stop-alert:',
  tripAlert: 'trip-alert:',
  daily: 'daily-reminder',
  startingSoon: 'starting-soon:',
} as const;

let handlerInstalled = false;

/** Notifications are silent-by-default until a handler says otherwise. */
export function installNotificationHandler(): void {
  if (handlerInstalled || Platform.OS === 'web') return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Budget alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    // iOS only ever shows the system prompt once, which is why the priming
    // sheet runs before this call.
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function cancelWithPrefix(prefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** True while today falls inside the trip's dates. */
export function isTripRunning(trip: Trip, today = todayIso()): boolean {
  if (!trip.startDate || !trip.endDate) return false;
  return today >= trip.startDate && today <= trip.endDate;
}

/* -------------------------------------------------------------------------- */
/* Budget alerts                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Fires immediately when spending crosses a threshold. Called after an expense
 * is logged, not on a timer — the crossing is the event.
 */
export async function notifyBudgetCrossing({
  settings,
  trip,
  scope,
  name,
  actual,
  cap,
  previousActual,
}: {
  settings: Settings;
  trip: Trip;
  scope: 'stop' | 'trip';
  name: string;
  actual: number;
  cap: number | null;
  previousActual: number;
}): Promise<void> {
  if (Platform.OS === 'web' || !settings.budgetAlerts || cap === null || cap <= 0) return;
  if (scope === 'stop' && !settings.perStopAlerts) return;
  if (scope === 'trip' && !settings.tripTotalAlerts) return;
  if (settings.onlyWhileTravelling && !isTripRunning(trip)) return;

  const before = statusFor(previousActual, cap);
  const after = statusFor(actual, cap);
  // Only the crossing is worth interrupting for — staying over is not news.
  if (before === after) return;

  const wants80 = settings.alertAt === '80' || settings.alertAt === 'both';
  const wants100 = settings.alertAt === '100' || settings.alertAt === 'both';

  let title: string | null = null;
  let body: string | null = null;

  if (after === 'over' && wants100) {
    const over = actual - cap;
    title = scope === 'trip' ? `${trip.name} is over budget` : `${name} is over budget`;
    body = `${formatMoney(actual, trip.currency, { compact: true })} spent of ${formatMoney(cap, trip.currency, { compact: true })}. You're ${formatMoney(over, trip.currency, { compact: true })} over.`;
  } else if (after === 'near' && wants80) {
    const left = cap - actual;
    const pct = Math.round((actual / cap) * 100);
    title = `${name} is at ${pct}%`;
    body = `${formatMoney(actual, trip.currency, { compact: true })} of ${formatMoney(cap, trip.currency, { compact: true })} spent. ${formatMoney(left, trip.currency, { compact: true })} left${scope === 'stop' ? ' at this stop' : ''}.`;
  }

  if (!title || !body) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${scope === 'stop' ? ID.stopAlert : ID.tripAlert}${name}`,
      content: { title, body, sound: false },
      trigger: null,  // now
    });
  } catch {
    // A notification that cannot be shown must never break logging an expense.
  }
}

/* -------------------------------------------------------------------------- */
/* Reminders                                                                  */
/* -------------------------------------------------------------------------- */

/** One daily nudge at the configured time, only while a trip is running. */
export async function rescheduleDailyReminder(
  settings: Settings,
  runningTrip: Trip | null,
): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelWithPrefix(ID.daily);
  if (!settings.dailyReminder || !runningTrip) return;
  if (settings.onlyWhileTravelling && !isTripRunning(runningTrip)) return;

  const [h, m] = settings.dailyReminderTime.split(':').map(Number);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ID.daily,
      content: {
        title: 'Log today’s spending',
        body: `${runningTrip.name} is under way. Add what you spent while it's fresh.`,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Number.isFinite(h) ? h : 20,
        minute: Number.isFinite(m) ? m : 0,
      },
    });
  } catch {
    /* best effort */
  }
}

/** The evening before a trip's start date. */
export async function scheduleTripStartingSoon(
  settings: Settings,
  trip: Trip,
  stopCount: number,
  stopsWithoutBudget: number,
): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelWithPrefix(`${ID.startingSoon}${trip.id}`);
  if (!settings.tripStartingSoon || !trip.startDate) return;

  const eveningBefore = new Date(`${trip.startDate}T18:00:00`);
  eveningBefore.setDate(eveningBefore.getDate() - 1);
  if (eveningBefore.getTime() <= Date.now()) return;

  const budgetLine =
    trip.totalBudgetMinor !== null
      ? `${stopCount} stop${stopCount === 1 ? '' : 's'} planned, ${formatMoney(trip.totalBudgetMinor, trip.currency, { compact: true })} budget.`
      : `${stopCount} stop${stopCount === 1 ? '' : 's'} planned.`;
  const gap =
    stopsWithoutBudget > 0
      ? ` ${stopsWithoutBudget} stop${stopsWithoutBudget === 1 ? '' : 's'} still ${stopsWithoutBudget === 1 ? 'has' : 'have'} no budget set.`
      : '';

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID.startingSoon}${trip.id}`,
      content: { title: `${trip.name} starts tomorrow`, body: budgetLine + gap, sound: false },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eveningBefore },
    });
  } catch {
    /* best effort */
  }
}

/** Cancels everything. Used when notifications are switched off wholesale. */
export async function cancelAll(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* best effort */
  }
}

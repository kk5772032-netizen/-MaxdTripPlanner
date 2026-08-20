import { create } from 'zustand';

import * as settingsRepo from '../db/repositories/settings';

/**
 * App settings.
 *
 * Defaults live here, not in the database — an unset key means "the default",
 * so a new setting doesn't need a migration and a cleared row falls back
 * cleanly.
 */
export interface Settings {
  /** Currency pre-selected on a new trip. */
  defaultCurrency: string;
  /** False until the onboarding carousel has been completed or skipped. */
  onboarded: boolean;
  /** Whether the notification priming sheet has been shown once. */
  notificationsAsked: boolean;

  budgetAlerts: boolean;
  /** Which crossing fires an alert. */
  alertAt: '80' | '100' | 'both';
  perStopAlerts: boolean;
  tripTotalAlerts: boolean;

  dailyReminder: boolean;
  /** 24h local time, "HH:MM". */
  dailyReminderTime: string;
  tripStartingSoon: boolean;
  /** Suppress everything outside a running trip. */
  onlyWhileTravelling: boolean;

  /** 'system' follows the OS. */
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULTS: Settings = {
  defaultCurrency: 'INR',
  onboarded: false,
  notificationsAsked: false,
  budgetAlerts: true,
  alertAt: 'both',
  perStopAlerts: true,
  tripTotalAlerts: true,
  dailyReminder: true,
  dailyReminderTime: '20:00',
  tripStartingSoon: true,
  onlyWhileTravelling: true,
  theme: 'system',
};

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const stored = await settingsRepo.readAll();
    // Only keys we know about, so a stale row can't inject an unexpected shape.
    const next: Partial<Settings> = {};
    for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      if (key in stored) next[key] = stored[key] as never;
    }
    set({ ...next, loaded: true });
  },

  set: async (key, value) => {
    // Optimistic: a toggle must move under the finger, not after a round-trip.
    set({ [key]: value } as never);
    try {
      await settingsRepo.write(key, value);
    } catch {
      set({ [key]: get()[key] } as never);
    }
  },
}));

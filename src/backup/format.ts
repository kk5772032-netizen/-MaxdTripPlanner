import type { Activity, Booking, Expense, FoodPlan, PackingItem, Stop, Trip } from '../types';

/**
 * What a backup file is.
 *
 * Everything about this format is chosen so that a file written today still
 * restores in two years: it is plain JSON with the app's own field names, it
 * carries its own version, and it holds only what a person typed. The Places
 * cache is not in it — that is a copy of Google's data with a thirty-day life,
 * and putting it in a backup would triple the file to save nothing. Settings
 * are not in it either: a backup restores your trips onto a phone whose
 * preferences are already set the way that phone's owner likes them.
 */

export const BACKUP_VERSION = 1;
export const BACKUP_KIND = 'waypoint.backup';

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: number;
  /** ISO instant, so a person can tell two files apart in a downloads folder. */
  exportedAt: string;
  trips: Trip[];
  stops: Stop[];
  activities: Activity[];
  foodPlans: FoodPlan[];
  expenses: Expense[];
  bookings: Booking[];
  packing: PackingItem[];
}

export interface BackupCounts {
  trips: number;
  stops: number;
  activities: number;
  foodPlans: number;
  expenses: number;
  bookings: number;
  packing: number;
}

export function countsOf(backup: Backup): BackupCounts {
  return {
    trips: backup.trips.length,
    stops: backup.stops.length,
    activities: backup.activities.length,
    foodPlans: backup.foodPlans.length,
    expenses: backup.expenses.length,
    bookings: backup.bookings.length,
    packing: backup.packing.length,
  };
}

export type ParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; reason: string };

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((v) => !!v && typeof v === 'object');
}

/**
 * Reads a file someone picked, which is the least trustworthy input in the app.
 *
 * Every failure has to name what is wrong, because the alternative — a restore
 * that half-succeeds and leaves the database in a state nobody can describe —
 * is the worst thing this feature could do. Nothing is written until this
 * returns ok.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file isn't a Waypoint backup — it isn't even JSON." };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: "That file isn't a Waypoint backup." };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.kind !== BACKUP_KIND) {
    return { ok: false, reason: "That file isn't a Waypoint backup." };
  }

  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: 'That backup was made by a newer version of Waypoint. Update the app first.',
    };
  }

  const tables = [
    'trips', 'stops', 'activities', 'foodPlans', 'expenses', 'bookings', 'packing',
  ] as const;
  for (const table of tables) {
    // A missing table is tolerated — an older file may predate bookings — but
    // something that is present and the wrong shape is a corrupt file.
    if (obj[table] !== undefined && !isRecordArray(obj[table])) {
      return { ok: false, reason: 'That backup is damaged and can’t be read.' };
    }
  }

  const trips = (obj.trips ?? []) as Trip[];
  if (trips.length === 0) {
    return { ok: false, reason: 'That backup has no trips in it.' };
  }
  if (!trips.every((t) => typeof t?.id === 'string' && typeof t?.name === 'string')) {
    return { ok: false, reason: 'That backup is damaged and can’t be read.' };
  }

  return {
    ok: true,
    backup: {
      kind: BACKUP_KIND,
      version: obj.version,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      trips,
      stops: (obj.stops ?? []) as Stop[],
      activities: (obj.activities ?? []) as Activity[],
      foodPlans: (obj.foodPlans ?? []) as FoodPlan[],
      expenses: (obj.expenses ?? []) as Expense[],
      bookings: (obj.bookings ?? []) as Booking[],
      packing: (obj.packing ?? []) as PackingItem[],
    },
  };
}

/** "waypoint-backup-2026-08-29.json" — sortable, and obvious in a file list. */
export function backupFileName(now = new Date()): string {
  return `waypoint-backup-${now.toISOString().slice(0, 10)}.json`;
}

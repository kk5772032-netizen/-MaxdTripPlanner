import type { Tombstone } from '../sync/merge';
import type {
  Activity, Booking, Expense, FoodPlan, JournalEntry, PackingItem, Stop, Traveller, Trip,
} from '../types';

/** A row with the stamp that decides who wins a merge. See `src/sync/hlc.ts`. */
export type Stamped<T> = T & { updatedAt: string };

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

/**
 * 2 added a stamp on every row and a list of deletions, which is what lets a
 * restore merge instead of replace. Version 1 files still restore: their rows
 * simply carry no stamp, and an unstamped row loses to a stamped one, which is
 * the truthful ordering for a file written before stamps existed.
 */
export const BACKUP_VERSION = 2;
export const BACKUP_KIND = 'waypoint.backup';

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: number;
  /** ISO instant, so a person can tell two files apart in a downloads folder. */
  exportedAt: string;
  trips: Stamped<Trip>[];
  stops: Stamped<Stop>[];
  activities: Stamped<Activity>[];
  foodPlans: Stamped<FoodPlan>[];
  expenses: Stamped<Expense>[];
  bookings: Stamped<Booking>[];
  packing: Stamped<PackingItem>[];
  /**
   * Notes travel; photos do not. The file paths point into the old phone's
   * storage and would restore as grey boxes, so entries come back with their
   * words and without their pictures. Saying so is better than a gallery of
   * missing files.
   */
  journal: Stamped<JournalEntry>[];
  travellers: Stamped<Traveller>[];
  /**
   * Rows that were deleted, so a merge does not hand them back. Absent in
   * version 1 files, where a delete simply could not travel.
   */
  tombstones: Tombstone[];
}

export interface BackupCounts {
  trips: number;
  stops: number;
  activities: number;
  foodPlans: number;
  expenses: number;
  bookings: number;
  packing: number;
  journal: number;
  travellers: number;
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
    journal: backup.journal.length,
    travellers: backup.travellers.length,
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
    'journal', 'travellers', 'tombstones',
  ] as const;
  for (const table of tables) {
    // A missing table is tolerated — an older file may predate bookings — but
    // something that is present and the wrong shape is a corrupt file.
    if (obj[table] !== undefined && !isRecordArray(obj[table])) {
      return { ok: false, reason: 'That backup is damaged and can’t be read.' };
    }
  }

  const trips = (obj.trips ?? []) as Stamped<Trip>[];
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
      stops: (obj.stops ?? []) as Stamped<Stop>[],
      activities: (obj.activities ?? []) as Stamped<Activity>[],
      foodPlans: (obj.foodPlans ?? []) as Stamped<FoodPlan>[],
      expenses: (obj.expenses ?? []) as Stamped<Expense>[],
      bookings: (obj.bookings ?? []) as Stamped<Booking>[],
      packing: (obj.packing ?? []) as Stamped<PackingItem>[],
      journal: (obj.journal ?? []) as Stamped<JournalEntry>[],
      travellers: (obj.travellers ?? []) as Stamped<Traveller>[],
      tombstones: (obj.tombstones ?? []) as Tombstone[],
    },
  };
}

/** "waypoint-backup-2026-08-29.json" — sortable, and obvious in a file list. */
export function backupFileName(now = new Date()): string {
  return `waypoint-backup-${now.toISOString().slice(0, 10)}.json`;
}

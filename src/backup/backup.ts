import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getDb, runInTransaction } from '../db/client';
import type {
  Activity, Booking, Expense, FoodPlan, PackingItem, Stop, Trip,
} from '../types';
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  type Backup,
  type BackupCounts,
  backupFileName,
  countsOf,
  parseBackup,
} from './format';

/**
 * Everything you have typed, as one file you own.
 *
 * This is not sync, and calling it sync would be a lie. It is the answer to
 * the only question sync is really asked to solve: "what happens to my trips
 * if I lose this phone?" A file you can put in Drive, mail to yourself, or
 * hand over on a cable answers that without an account, a server, or anything
 * of yours leaving the device except when you say so.
 */

/* -------------------------------------------------------------------------- */
/* Reading the database out                                                   */
/* -------------------------------------------------------------------------- */

interface TripRow {
  id: string; name: string; start_date: string | null; end_date: string | null;
  currency: string; home_currency: string | null; rate_ppm: number | null;
  total_budget: number | null; created_at: string;
}
interface StopRow {
  id: string; trip_id: string; google_place_id: string | null; name: string;
  address: string | null; lat: number | null; lng: number | null; rating: number | null;
  photo_ref: string | null; sequence: number; day_date: string | null;
  start_time: string | null; end_time: string | null; planned_budget: number | null;
  notes: string | null;
}
interface ActivityRow {
  id: string; stop_id: string; title: string; estimated_cost: number | null;
  done: number; start_time: string | null; duration_min: number | null; notes: string | null;
}
interface FoodRow {
  id: string; stop_id: string; google_place_id: string | null; name: string;
  cuisine: string | null; estimated_cost: number | null; notes: string | null;
}
interface ExpenseRow {
  id: string; trip_id: string; stop_id: string | null; category: string;
  amount: number; note: string | null; spent_at: string; booking_id: string | null;
}
interface PackingRow {
  id: string; trip_id: string; title: string; category: string | null;
  packed: number; sequence: number;
}
interface BookingRow {
  id: string; trip_id: string; kind: string; title: string; confirmation: string | null;
  starts_at: string | null; ends_at: string | null; location: string | null;
  cost: number | null; notes: string | null; attachment_uri: string | null;
  attachment_name: string | null; created_at: string;
}

export async function buildBackup(now = new Date()): Promise<Backup> {
  const db = await getDb();
  const [trips, stops, activities, foods, expenses, bookings, packing] = await Promise.all([
    db.getAllAsync<TripRow>('SELECT * FROM trips ORDER BY created_at ASC'),
    db.getAllAsync<StopRow>('SELECT * FROM stops ORDER BY trip_id, sequence ASC'),
    db.getAllAsync<ActivityRow>('SELECT * FROM activities ORDER BY rowid ASC'),
    db.getAllAsync<FoodRow>('SELECT * FROM food_plans ORDER BY rowid ASC'),
    db.getAllAsync<ExpenseRow>('SELECT * FROM expenses ORDER BY spent_at ASC'),
    db.getAllAsync<BookingRow>('SELECT * FROM bookings ORDER BY created_at ASC'),
    db.getAllAsync<PackingRow>('SELECT * FROM packing_items ORDER BY trip_id, sequence ASC'),
  ]);

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    trips: trips.map(
      (r): Trip => ({
        id: r.id, name: r.name, startDate: r.start_date, endDate: r.end_date,
        currency: r.currency, homeCurrency: r.home_currency ?? null,
        ratePpm: r.rate_ppm ?? null,
        totalBudgetMinor: r.total_budget, createdAt: r.created_at,
      }),
    ),
    stops: stops.map(
      (r): Stop => ({
        id: r.id, tripId: r.trip_id, googlePlaceId: r.google_place_id, name: r.name,
        address: r.address, lat: r.lat, lng: r.lng, rating: r.rating, photoRef: r.photo_ref,
        sequence: r.sequence, dayDate: r.day_date, startTime: r.start_time,
        endTime: r.end_time, plannedBudgetMinor: r.planned_budget, notes: r.notes,
      }),
    ),
    activities: activities.map(
      (r): Activity => ({
        id: r.id, stopId: r.stop_id, title: r.title, estimatedCostMinor: r.estimated_cost,
        done: r.done === 1, startTime: r.start_time, durationMin: r.duration_min,
        notes: r.notes,
      }),
    ),
    foodPlans: foods.map(
      (r): FoodPlan => ({
        id: r.id, stopId: r.stop_id, googlePlaceId: r.google_place_id, name: r.name,
        cuisine: r.cuisine, estimatedCostMinor: r.estimated_cost, notes: r.notes,
      }),
    ),
    expenses: expenses.map(
      (r): Expense => ({
        id: r.id, tripId: r.trip_id, stopId: r.stop_id,
        category: r.category as Expense['category'], amountMinor: r.amount,
        note: r.note, spentAt: r.spent_at, bookingId: r.booking_id ?? null,
      }),
    ),
    bookings: bookings.map(
      (r): Booking => ({
        id: r.id, tripId: r.trip_id, kind: r.kind as Booking['kind'], title: r.title,
        confirmation: r.confirmation, startsAt: r.starts_at, endsAt: r.ends_at,
        location: r.location, costMinor: r.cost, notes: r.notes,
        // Attachments are files on the old phone; the paths would not resolve
        // on a new one. The booking survives, the copy of the ticket does not.
        attachmentUri: null, attachmentName: null,
        createdAt: r.created_at,
      }),
    ),
    packing: packing.map(
      (r): PackingItem => ({
        id: r.id, tripId: r.trip_id, title: r.title, category: r.category,
        packed: r.packed === 1, sequence: r.sequence,
      }),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Writing it back in                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Replaces everything. Merging was the other option and it is a trap: two
 * copies of a trip edited on two phones cannot be reconciled without asking
 * questions nobody wants at a restore prompt, and half-merged trips are worse
 * than either version. One transaction, so a failure leaves what was there.
 */
export async function restoreBackup(backup: Backup): Promise<BackupCounts> {
  const db = await getDb();

  await runInTransaction(db, async (tx) => {
    // Children first: foreign keys are on, and trips cascade anyway, but being
    // explicit means this still works if a future table forgets to cascade.
    for (const table of [
      'expenses', 'bookings', 'packing_items', 'activities', 'food_plans', 'stops', 'trips',
    ]) {
      await tx.runAsync(`DELETE FROM ${table}`);
    }

    for (const t of backup.trips) {
      await tx.runAsync(
        `INSERT INTO trips (id, name, start_date, end_date, currency, home_currency,
           rate_ppm, total_budget, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id, t.name, t.startDate, t.endDate, t.currency, t.homeCurrency ?? null,
        t.ratePpm ?? null, t.totalBudgetMinor, t.createdAt,
      );
    }
    for (const s of backup.stops) {
      await tx.runAsync(
        `INSERT INTO stops (id, trip_id, google_place_id, name, address, lat, lng, rating,
           photo_ref, sequence, day_date, start_time, end_time, planned_budget, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id, s.tripId, s.googlePlaceId, s.name, s.address, s.lat, s.lng, s.rating,
        s.photoRef, s.sequence, s.dayDate ?? null, s.startTime ?? null, s.endTime ?? null,
        s.plannedBudgetMinor, s.notes,
      );
    }
    for (const a of backup.activities) {
      await tx.runAsync(
        `INSERT INTO activities (id, stop_id, title, estimated_cost, done, start_time,
           duration_min, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id, a.stopId, a.title, a.estimatedCostMinor, a.done ? 1 : 0,
        a.startTime ?? null, a.durationMin ?? null, a.notes ?? null,
      );
    }
    for (const f of backup.foodPlans) {
      await tx.runAsync(
        `INSERT INTO food_plans (id, stop_id, google_place_id, name, cuisine, estimated_cost, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        f.id, f.stopId, f.googlePlaceId, f.name, f.cuisine, f.estimatedCostMinor, f.notes,
      );
    }
    for (const b of backup.bookings) {
      await tx.runAsync(
        `INSERT INTO bookings (id, trip_id, kind, title, confirmation, starts_at, ends_at,
           location, cost, notes, attachment_uri, attachment_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        b.id, b.tripId, b.kind, b.title, b.confirmation, b.startsAt, b.endsAt,
        b.location, b.costMinor, b.notes, b.attachmentUri, b.attachmentName, b.createdAt,
      );
    }
    // After bookings: an expense can carry a booking_id, and the foreign key
    // fires if the booking is not in place yet.
    for (const e of backup.expenses) {
      await tx.runAsync(
        `INSERT INTO expenses
           (id, trip_id, stop_id, category, amount, note, spent_at, booking_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id, e.tripId, e.stopId, e.category, e.amountMinor, e.note, e.spentAt,
        e.bookingId ?? null,
      );
    }
    for (const i of backup.packing ?? []) {
      await tx.runAsync(
        `INSERT INTO packing_items (id, trip_id, title, category, packed, sequence)
         VALUES (?, ?, ?, ?, ?, ?)`,
        i.id, i.tripId, i.title, i.category ?? null, i.packed ? 1 : 0, i.sequence ?? 0,
      );
    }
  });

  return countsOf(backup);
}

/* -------------------------------------------------------------------------- */
/* The file, and the share sheet                                              */
/* -------------------------------------------------------------------------- */

export type BackupOutcome =
  | { ok: true; counts: BackupCounts }
  | { ok: false; reason: null }
  | { ok: false; reason: string };

const FOLDER = 'backups';

/** Writes the backup to a file and hands it to the share sheet. */
export async function shareBackup(): Promise<BackupOutcome> {
  let backup: Backup;
  try {
    backup = await buildBackup();
  } catch (e) {
    console.warn('[backup] read failed', e);
    return { ok: false, reason: "Couldn't read your trips." };
  }

  if (backup.trips.length === 0) {
    return { ok: false, reason: 'There are no trips to back up yet.' };
  }

  const json = JSON.stringify(backup, null, 2);
  const name = backupFileName();

  if (Platform.OS === 'web') {
    // No share sheet and no filesystem worth the name; a download is what a
    // browser can actually give someone.
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      return { ok: true, counts: countsOf(backup) };
    } catch {
      return { ok: false, reason: "This browser wouldn't save the file." };
    }
  }

  try {
    const dir = new Directory(Paths.cache, FOLDER);
    dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, name);
    if (file.exists) file.delete();
    file.create();
    file.write(json);

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'Sharing is unavailable on this device.' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Back up your trips',
    });
    return { ok: true, counts: countsOf(backup) };
  } catch (e) {
    console.warn('[backup] write failed', e);
    return { ok: false, reason: "Couldn't write the backup file." };
  }
}

/** Picks a backup file and reads it. Writes nothing — that is `restoreBackup`. */
export async function pickBackup(): Promise<
  { ok: true; backup: Backup } | { ok: false; reason: string | null }
> {
  let picked: DocumentPicker.DocumentPickerResult;
  try {
    picked = await DocumentPicker.getDocumentAsync({
      // Some file providers hand JSON back as octet-stream, so the type filter
      // has to stay open or the file you want is greyed out in the picker.
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch (e) {
    console.warn('[backup] picker failed', e);
    return { ok: false, reason: "Couldn't open the file picker." };
  }

  if (picked.canceled) return { ok: false, reason: null };
  const asset = picked.assets?.[0];
  if (!asset) return { ok: false, reason: "That file couldn't be read." };

  let text: string;
  try {
    text = Platform.OS === 'web'
      ? await (await fetch(asset.uri)).text()
      : new File(asset.uri).textSync();
  } catch (e) {
    console.warn('[backup] read failed', e);
    return { ok: false, reason: "That file couldn't be read." };
  }

  const parsed = parseBackup(text);
  return parsed.ok ? { ok: true, backup: parsed.backup } : { ok: false, reason: parsed.reason };
}

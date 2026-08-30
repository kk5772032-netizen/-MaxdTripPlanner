import type { Stop } from '../../types';
import { getDb, runInTransaction } from '../client';
import { newId } from '../ids';
import { stamp, tombstone, unTombstone } from '../../sync/stamping';

interface StopRow {
  id: string;
  trip_id: string;
  google_place_id: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photo_ref: string | null;
  sequence: number;
  day_date: string | null;
  start_time: string | null;
  end_time: string | null;
  planned_budget: number | null;
  notes: string | null;
}

function toStop(row: StopRow): Stop {
  return {
    id: row.id,
    tripId: row.trip_id,
    googlePlaceId: row.google_place_id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    rating: row.rating,
    photoRef: row.photo_ref,
    sequence: row.sequence,
    dayDate: row.day_date,
    startTime: row.start_time,
    endTime: row.end_time,
    plannedBudgetMinor: row.planned_budget,
    notes: row.notes,
  };
}

/**
 * `sequence` is assigned by the repository — callers never pick it. Scheduling
 * is optional: a stop is usually collected before anyone decides which day it
 * belongs to.
 */
export type NewStop = Omit<Stop, 'id' | 'sequence' | 'dayDate' | 'startTime' | 'endTime'> &
  Partial<Pick<Stop, 'dayDate' | 'startTime' | 'endTime'>>;

export async function createStop(input: NewStop): Promise<Stop> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ next: number }>(
    `SELECT COALESCE(MAX(sequence) + 1, 0) AS next FROM stops WHERE trip_id = ?`,
    input.tripId,
  );
  const stop: Stop = {
    dayDate: null,
    startTime: null,
    endTime: null,
    ...input,
    id: newId(),
    sequence: row?.next ?? 0,
  };
  await db.runAsync(
    `INSERT INTO stops
       (id, trip_id, google_place_id, name, address, lat, lng, rating, photo_ref, updated_at, sequence,
        day_date, start_time, end_time, planned_budget, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    stop.id,
    stop.tripId,
    stop.googlePlaceId,
    stop.name,
    stop.address,
    stop.lat,
    stop.lng,
    stop.rating,
    stop.photoRef,
    await stamp(),
    stop.sequence,
    stop.dayDate,
    stop.startTime,
    stop.endTime,
    stop.plannedBudgetMinor,
    stop.notes,
  );
  return stop;
}

export async function listStops(tripId: string): Promise<Stop[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StopRow>(
    `SELECT * FROM stops WHERE trip_id = ? ORDER BY sequence ASC`,
    tripId,
  );
  return rows.map(toStop);
}

/** Stop count per trip, for the trip list. Counted in SQL, not by loading rows. */
export async function countsByTrip(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ trip_id: string; count: number }>(
    `SELECT trip_id, COUNT(*) AS count FROM stops GROUP BY trip_id`,
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.trip_id] = row.count;
  return counts;
}

export async function getStop(id: string): Promise<Stop | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<StopRow>(`SELECT * FROM stops WHERE id = ?`, id);
  return row ? toStop(row) : null;
}

export async function updateStop(
  id: string,
  patch: Partial<Omit<Stop, 'id' | 'tripId'>>,
): Promise<Stop | null> {
  const existing = await getStop(id);
  if (!existing) return null;

  const next: Stop = { ...existing, ...patch };
  const db = await getDb();
  await db.runAsync(
    `UPDATE stops
        SET google_place_id = ?, name = ?, address = ?, lat = ?, lng = ?, rating = ?,
            photo_ref = ?, sequence = ?, day_date = ?, start_time = ?, end_time = ?,
            planned_budget = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
    next.googlePlaceId,
    next.name,
    next.address,
    next.lat,
    next.lng,
    next.rating,
    next.photoRef,
    next.sequence,
    next.dayDate,
    next.startTime,
    next.endTime,
    next.plannedBudgetMinor,
    next.notes,
    await stamp(),
    id,
  );
  return next;
}

export async function deleteStop(id: string): Promise<void> {
  const db = await getDb();
  const stop = await getStop(id);
  if (!stop) return;
  await db.runAsync(`DELETE FROM stops WHERE id = ?`, id);
  await tombstone('stops', id);
  // Close the gap so sequence stays dense: 0,1,2,... with no holes.
  await db.runAsync(
    `UPDATE stops SET sequence = sequence - 1 WHERE trip_id = ? AND sequence > ?`,
    stop.tripId,
    stop.sequence,
  );
}

/**
 * Puts a deleted stop back where it was.
 *
 * `deleteStop` closes the sequence gap behind it, so restoring has to reopen
 * that gap before re-inserting — otherwise the restored stop collides with
 * whichever stop slid into its place.
 */
export async function restoreStop(stop: Stop): Promise<void> {
  const db = await getDb();
  const mark = await stamp();
  await runInTransaction(db, async (tx) => {
    await tx.runAsync(
      `UPDATE stops SET sequence = sequence + 1 WHERE trip_id = ? AND sequence >= ?`,
      stop.tripId, stop.sequence,
    );
    await tx.runAsync(
      `INSERT OR REPLACE INTO stops
         (id, trip_id, google_place_id, name, address, lat, lng, rating, photo_ref, sequence,
          day_date, start_time, end_time, planned_budget, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      stop.id, stop.tripId, stop.googlePlaceId, stop.name, stop.address, stop.lat,
      stop.lng, stop.rating, stop.photoRef, stop.sequence,
      stop.dayDate, stop.startTime, stop.endTime, stop.plannedBudgetMinor, stop.notes,
      mark,
    );
  });
  // The row is back, so its grave has to be filled in or the next merge would
  // see a live row older than its own tombstone and delete it again.
  await unTombstone('stops', stop.id);
}

/**
 * Rewrites `sequence` for a trip to match the given id order.
 *
 * Sequence has no UNIQUE constraint, so a straight rewrite is safe and avoids
 * the two-pass shuffle a unique index would force.
 */
export async function reorderStops(tripId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  // Stamps are minted before the transaction: `stamp()` writes to the settings
  // table, and nesting that inside this one would deadlock on some drivers.
  const marks: string[] = [];
  for (let i = 0; i < orderedIds.length; i++) marks.push(await stamp());
  await runInTransaction(db, async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.runAsync(
        `UPDATE stops SET sequence = ?, updated_at = ? WHERE id = ? AND trip_id = ?`,
        i,
        marks[i],
        orderedIds[i],
        tripId,
      );
    }
  });
}

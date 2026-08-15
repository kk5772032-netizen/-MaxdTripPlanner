import type { Stop } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';

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
    plannedBudgetMinor: row.planned_budget,
    notes: row.notes,
  };
}

/** `sequence` is assigned by the repository — callers never pick it. */
export type NewStop = Omit<Stop, 'id' | 'sequence'>;

export async function createStop(input: NewStop): Promise<Stop> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ next: number }>(
    `SELECT COALESCE(MAX(sequence) + 1, 0) AS next FROM stops WHERE trip_id = ?`,
    input.tripId,
  );
  const stop: Stop = { ...input, id: newId(), sequence: row?.next ?? 0 };
  await db.runAsync(
    `INSERT INTO stops
       (id, trip_id, google_place_id, name, address, lat, lng, rating, photo_ref, sequence, planned_budget, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    stop.id,
    stop.tripId,
    stop.googlePlaceId,
    stop.name,
    stop.address,
    stop.lat,
    stop.lng,
    stop.rating,
    stop.photoRef,
    stop.sequence,
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
            photo_ref = ?, sequence = ?, planned_budget = ?, notes = ?
      WHERE id = ?`,
    next.googlePlaceId,
    next.name,
    next.address,
    next.lat,
    next.lng,
    next.rating,
    next.photoRef,
    next.sequence,
    next.plannedBudgetMinor,
    next.notes,
    id,
  );
  return next;
}

export async function deleteStop(id: string): Promise<void> {
  const db = await getDb();
  const stop = await getStop(id);
  if (!stop) return;
  await db.runAsync(`DELETE FROM stops WHERE id = ?`, id);
  // Close the gap so sequence stays dense: 0,1,2,... with no holes.
  await db.runAsync(
    `UPDATE stops SET sequence = sequence - 1 WHERE trip_id = ? AND sequence > ?`,
    stop.tripId,
    stop.sequence,
  );
}

/**
 * Rewrites `sequence` for a trip to match the given id order.
 *
 * Sequence has no UNIQUE constraint, so a straight rewrite is safe and avoids
 * the two-pass shuffle a unique index would force.
 */
export async function reorderStops(tripId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.runAsync(
        `UPDATE stops SET sequence = ? WHERE id = ? AND trip_id = ?`,
        i,
        orderedIds[i],
        tripId,
      );
    }
  });
}

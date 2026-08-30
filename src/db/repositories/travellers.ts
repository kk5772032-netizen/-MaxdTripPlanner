import type { Traveller } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';
import { stamp, tombstone, unTombstone } from '../../sync/stamping';

interface TravellerRow {
  id: string;
  trip_id: string;
  name: string;
  sequence: number;
}

function toTraveller(row: TravellerRow): Traveller {
  return { id: row.id, tripId: row.trip_id, name: row.name, sequence: row.sequence };
}

export type NewTraveller = Omit<Traveller, 'id' | 'sequence'> &
  Partial<Pick<Traveller, 'sequence'>>;

export async function listTravellers(tripId: string): Promise<Traveller[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TravellerRow>(
    `SELECT * FROM travellers WHERE trip_id = ? ORDER BY sequence ASC, rowid ASC`,
    tripId,
  );
  return rows.map(toTraveller);
}

export async function createTraveller(input: NewTraveller): Promise<Traveller> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ next: number }>(
    `SELECT COALESCE(MAX(sequence), -1) + 1 AS next FROM travellers WHERE trip_id = ?`,
    input.tripId,
  );
  const traveller: Traveller = { sequence: row?.next ?? 0, ...input, id: newId() };
  await db.runAsync(
    `INSERT INTO travellers (id, trip_id, name, sequence, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    traveller.id, traveller.tripId, traveller.name, traveller.sequence, await stamp(),
  );
  return traveller;
}

export async function updateTraveller(
  id: string,
  patch: Partial<Omit<Traveller, 'id' | 'tripId'>>,
): Promise<Traveller | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TravellerRow>(
    `SELECT * FROM travellers WHERE id = ?`,
    id,
  );
  if (!row) return null;

  const next: Traveller = { ...toTraveller(row), ...patch };
  await db.runAsync(
    `UPDATE travellers SET name = ?, sequence = ?, updated_at = ? WHERE id = ?`,
    next.name, next.sequence, await stamp(), id,
  );
  return next;
}

/**
 * Removing someone leaves their expenses behind.
 *
 * `paid_by` goes null, so those expenses drop out of the settle-up but stay in
 * the budget — the money was still spent. Deleting the spending along with the
 * person would quietly change what the trip cost.
 */
export async function deleteTraveller(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM travellers WHERE id = ?`, id);
  await tombstone('travellers', id);
}

export async function restoreTraveller(t: Traveller): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO travellers (id, trip_id, name, sequence, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    t.id, t.tripId, t.name, t.sequence, await stamp(),
  );
  await unTombstone('travellers', t.id);
}

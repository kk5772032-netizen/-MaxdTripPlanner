import type { Trip } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';
import { stamp, tombstone, unTombstone } from '../../sync/stamping';

interface TripRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  home_currency: string | null;
  rate_ppm: number | null;
  total_budget: number | null;
  created_at: string;
}

function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    currency: row.currency,
    homeCurrency: row.home_currency ?? null,
    ratePpm: row.rate_ppm ?? null,
    totalBudgetMinor: row.total_budget,
    createdAt: row.created_at,
  };
}

/** A second currency is the exception, so it defaults to absent. */
export type NewTrip = Omit<Trip, 'id' | 'createdAt' | 'homeCurrency' | 'ratePpm'> &
  Partial<Pick<Trip, 'homeCurrency' | 'ratePpm'>>;

export async function createTrip(input: NewTrip): Promise<Trip> {
  const db = await getDb();
  const trip: Trip = {
    homeCurrency: null,
    ratePpm: null,
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO trips
       (id, name, start_date, end_date, currency, home_currency, rate_ppm,
        total_budget, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    trip.id,
    trip.name,
    trip.startDate,
    trip.endDate,
    trip.currency,
    trip.homeCurrency,
    trip.ratePpm,
    trip.totalBudgetMinor,
    trip.createdAt,
    await stamp(),
  );
  return trip;
}

export async function listTrips(): Promise<Trip[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TripRow>(
    `SELECT * FROM trips ORDER BY COALESCE(start_date, created_at) DESC, created_at DESC`,
  );
  return rows.map(toTrip);
}

export async function getTrip(id: string): Promise<Trip | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TripRow>(`SELECT * FROM trips WHERE id = ?`, id);
  return row ? toTrip(row) : null;
}

export async function updateTrip(
  id: string,
  patch: Partial<NewTrip>,
): Promise<Trip | null> {
  const existing = await getTrip(id);
  if (!existing) return null;

  const next: Trip = { ...existing, ...patch };
  const db = await getDb();
  await db.runAsync(
    `UPDATE trips
        SET name = ?, start_date = ?, end_date = ?, currency = ?, home_currency = ?,
            rate_ppm = ?, total_budget = ?, updated_at = ?
      WHERE id = ?`,
    next.name,
    next.startDate,
    next.endDate,
    next.currency,
    next.homeCurrency,
    next.ratePpm,
    next.totalBudgetMinor,
    await stamp(),
    id,
  );
  return next;
}

/** Cascades to stops -> activities/food_plans, and to expenses. */
export async function deleteTrip(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM trips WHERE id = ?`, id);
  // Only the trip is tombstoned; its children cascade, and a merge that has
  // lost the trip has nowhere to put them anyway.
  await tombstone('trips', id);
}

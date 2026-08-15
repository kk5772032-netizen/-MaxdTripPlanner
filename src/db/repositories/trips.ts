import type { Trip } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';

interface TripRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
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
    totalBudgetMinor: row.total_budget,
    createdAt: row.created_at,
  };
}

export type NewTrip = Omit<Trip, 'id' | 'createdAt'>;

export async function createTrip(input: NewTrip): Promise<Trip> {
  const db = await getDb();
  const trip: Trip = { ...input, id: newId(), createdAt: new Date().toISOString() };
  await db.runAsync(
    `INSERT INTO trips (id, name, start_date, end_date, currency, total_budget, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    trip.id,
    trip.name,
    trip.startDate,
    trip.endDate,
    trip.currency,
    trip.totalBudgetMinor,
    trip.createdAt,
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
        SET name = ?, start_date = ?, end_date = ?, currency = ?, total_budget = ?
      WHERE id = ?`,
    next.name,
    next.startDate,
    next.endDate,
    next.currency,
    next.totalBudgetMinor,
    id,
  );
  return next;
}

/** Cascades to stops -> activities/food_plans, and to expenses. */
export async function deleteTrip(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM trips WHERE id = ?`, id);
}

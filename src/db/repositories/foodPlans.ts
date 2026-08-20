import type { FoodPlan } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';

interface FoodPlanRow {
  id: string;
  stop_id: string;
  google_place_id: string | null;
  name: string;
  cuisine: string | null;
  estimated_cost: number | null;
  notes: string | null;
}

function toFoodPlan(row: FoodPlanRow): FoodPlan {
  return {
    id: row.id,
    stopId: row.stop_id,
    googlePlaceId: row.google_place_id,
    name: row.name,
    cuisine: row.cuisine,
    estimatedCostMinor: row.estimated_cost,
    notes: row.notes,
  };
}

export type NewFoodPlan = Omit<FoodPlan, 'id'>;

export async function createFoodPlan(input: NewFoodPlan): Promise<FoodPlan> {
  const db = await getDb();
  const plan: FoodPlan = { ...input, id: newId() };
  await db.runAsync(
    `INSERT INTO food_plans (id, stop_id, google_place_id, name, cuisine, estimated_cost, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    plan.id,
    plan.stopId,
    plan.googlePlaceId,
    plan.name,
    plan.cuisine,
    plan.estimatedCostMinor,
    plan.notes,
  );
  return plan;
}

export async function restoreFoodPlan(f: FoodPlan): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO food_plans (id, stop_id, google_place_id, name, cuisine, estimated_cost, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    f.id, f.stopId, f.googlePlaceId, f.name, f.cuisine, f.estimatedCostMinor, f.notes,
  );
}

export async function listFoodPlans(stopId: string): Promise<FoodPlan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoodPlanRow>(
    `SELECT * FROM food_plans WHERE stop_id = ? ORDER BY rowid ASC`,
    stopId,
  );
  return rows.map(toFoodPlan);
}

/** Every food plan across a trip, for budget roll-ups. */
export async function listFoodPlansForTrip(tripId: string): Promise<FoodPlan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoodPlanRow>(
    `SELECT f.* FROM food_plans f
       JOIN stops s ON s.id = f.stop_id
      WHERE s.trip_id = ?
      ORDER BY s.sequence ASC, f.rowid ASC`,
    tripId,
  );
  return rows.map(toFoodPlan);
}

export async function updateFoodPlan(
  id: string,
  patch: Partial<Omit<FoodPlan, 'id' | 'stopId'>>,
): Promise<FoodPlan | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FoodPlanRow>(
    `SELECT * FROM food_plans WHERE id = ?`,
    id,
  );
  if (!row) return null;

  const next: FoodPlan = { ...toFoodPlan(row), ...patch };
  await db.runAsync(
    `UPDATE food_plans
        SET google_place_id = ?, name = ?, cuisine = ?, estimated_cost = ?, notes = ?
      WHERE id = ?`,
    next.googlePlaceId,
    next.name,
    next.cuisine,
    next.estimatedCostMinor,
    next.notes,
    id,
  );
  return next;
}

export async function deleteFoodPlan(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM food_plans WHERE id = ?`, id);
}

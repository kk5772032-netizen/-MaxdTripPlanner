import type { Activity } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';

interface ActivityRow {
  id: string;
  stop_id: string;
  title: string;
  estimated_cost: number | null;
  done: number;
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    stopId: row.stop_id,
    title: row.title,
    estimatedCostMinor: row.estimated_cost,
    done: row.done === 1,
  };
}

export type NewActivity = Omit<Activity, 'id'>;

export async function createActivity(input: NewActivity): Promise<Activity> {
  const db = await getDb();
  const activity: Activity = { ...input, id: newId() };
  await db.runAsync(
    `INSERT INTO activities (id, stop_id, title, estimated_cost, done) VALUES (?, ?, ?, ?, ?)`,
    activity.id,
    activity.stopId,
    activity.title,
    activity.estimatedCostMinor,
    activity.done ? 1 : 0,
  );
  return activity;
}

export async function restoreActivity(a: Activity): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO activities (id, stop_id, title, estimated_cost, done)
     VALUES (?, ?, ?, ?, ?)`,
    a.id, a.stopId, a.title, a.estimatedCostMinor, a.done ? 1 : 0,
  );
}

export async function listActivities(stopId: string): Promise<Activity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT * FROM activities WHERE stop_id = ? ORDER BY rowid ASC`,
    stopId,
  );
  return rows.map(toActivity);
}

/** Every activity across a trip, for budget roll-ups. */
export async function listActivitiesForTrip(tripId: string): Promise<Activity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT a.* FROM activities a
       JOIN stops s ON s.id = a.stop_id
      WHERE s.trip_id = ?
      ORDER BY s.sequence ASC, a.rowid ASC`,
    tripId,
  );
  return rows.map(toActivity);
}

export async function updateActivity(
  id: string,
  patch: Partial<Omit<Activity, 'id' | 'stopId'>>,
): Promise<Activity | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ActivityRow>(
    `SELECT * FROM activities WHERE id = ?`,
    id,
  );
  if (!row) return null;

  const next: Activity = { ...toActivity(row), ...patch };
  await db.runAsync(
    `UPDATE activities SET title = ?, estimated_cost = ?, done = ? WHERE id = ?`,
    next.title,
    next.estimatedCostMinor,
    next.done ? 1 : 0,
    id,
  );
  return next;
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM activities WHERE id = ?`, id);
}

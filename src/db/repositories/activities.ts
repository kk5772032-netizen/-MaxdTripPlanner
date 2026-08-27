import type { Activity } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';

interface ActivityRow {
  id: string;
  stop_id: string;
  title: string;
  estimated_cost: number | null;
  done: number;
  start_time: string | null;
  duration_min: number | null;
  notes: string | null;
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    stopId: row.stop_id,
    title: row.title,
    estimatedCostMinor: row.estimated_cost,
    done: row.done === 1,
    startTime: row.start_time,
    durationMin: row.duration_min,
    notes: row.notes,
  };
}

/**
 * Timing is optional. Most entries start life as a to-do — "see the memorial" —
 * and only some of them ever get a time.
 */
export type NewActivity = Omit<Activity, 'id' | 'startTime' | 'durationMin' | 'notes'> &
  Partial<Pick<Activity, 'startTime' | 'durationMin' | 'notes'>>;

export async function createActivity(input: NewActivity): Promise<Activity> {
  const db = await getDb();
  const activity: Activity = {
    startTime: null,
    durationMin: null,
    notes: null,
    ...input,
    id: newId(),
  };
  await db.runAsync(
    `INSERT INTO activities (id, stop_id, title, estimated_cost, done, start_time, duration_min, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.stopId,
    activity.title,
    activity.estimatedCostMinor,
    activity.done ? 1 : 0,
    activity.startTime,
    activity.durationMin,
    activity.notes,
  );
  return activity;
}

export async function restoreActivity(a: Activity): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO activities
       (id, stop_id, title, estimated_cost, done, start_time, duration_min, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    a.id, a.stopId, a.title, a.estimatedCostMinor, a.done ? 1 : 0,
    a.startTime, a.durationMin, a.notes,
  );
}

export async function listActivities(stopId: string): Promise<Activity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT * FROM activities WHERE stop_id = ?
      ORDER BY start_time IS NULL, start_time ASC, rowid ASC`,
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
    `UPDATE activities
        SET title = ?, estimated_cost = ?, done = ?, start_time = ?, duration_min = ?, notes = ?
      WHERE id = ?`,
    next.title,
    next.estimatedCostMinor,
    next.done ? 1 : 0,
    next.startTime,
    next.durationMin,
    next.notes,
    id,
  );
  return next;
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM activities WHERE id = ?`, id);
}

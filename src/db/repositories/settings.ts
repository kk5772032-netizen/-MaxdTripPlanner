import { getDb } from '../client';

/**
 * Key/value settings, JSON-encoded.
 *
 * Small enough that the whole set is read at once on boot; writes are
 * individual so one screen saving a toggle can't clobber another's.
 */

export async function readAll(): Promise<Record<string, unknown>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings`,
  );
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      // A corrupt value is dropped rather than failing the whole read — the
      // caller's default then applies.
    }
  }
  return out;
}

export async function write(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    JSON.stringify(value),
  );
}

export async function remove(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM settings WHERE key = ?`, key);
}

/** Wipes every table. Used by Settings → Delete all data. */
export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM expenses;
    DELETE FROM food_plans;
    DELETE FROM activities;
    DELETE FROM stops;
    DELETE FROM trips;
    DELETE FROM places_cache;
  `);
}

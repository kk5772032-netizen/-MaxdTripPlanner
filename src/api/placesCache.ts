import { getDb } from '../db/client';

/**
 * SQLite-backed cache for Places API responses.
 *
 * Places is billed per request, so every response we can reuse is money not
 * spent. A landmark's address doesn't change, and the list of restaurants near
 * it doesn't change hour to hour — 30 days is a reasonable staleness budget for
 * both.
 *
 * Cached entries are also what makes the app usable offline: `read` ignores TTL
 * when asked to, so a stale hit beats an empty screen when the network is gone.
 */

export type RequestType = 'details' | 'nearby';

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CacheRow {
  payload: string;
  fetched_at: number;
}

export interface CacheHit<T> {
  value: T;
  fetchedAt: number;
  /** True when the entry is past its TTL and was only returned as a fallback. */
  stale: boolean;
}

function key(type: RequestType, placeId: string): string {
  return `${type}:${placeId}`;
}

/**
 * Reads a cached response.
 *
 * `allowStale` returns expired entries (flagged as such) instead of null —
 * used when the network call has already failed.
 */
export async function read<T>(
  type: RequestType,
  placeId: string,
  { allowStale = false }: { allowStale?: boolean } = {},
): Promise<CacheHit<T> | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CacheRow>(
    `SELECT payload, fetched_at FROM places_cache WHERE cache_key = ?`,
    key(type, placeId),
  );
  if (!row) return null;

  const stale = Date.now() - row.fetched_at > CACHE_TTL_MS;
  if (stale && !allowStale) return null;

  try {
    return { value: JSON.parse(row.payload) as T, fetchedAt: row.fetched_at, stale };
  } catch {
    // Corrupt row — drop it rather than failing the caller forever.
    await db.runAsync(`DELETE FROM places_cache WHERE cache_key = ?`, key(type, placeId));
    return null;
  }
}

export async function write<T>(type: RequestType, placeId: string, value: T): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO places_cache (cache_key, request_type, place_id, payload, fetched_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    key(type, placeId),
    type,
    placeId,
    JSON.stringify(value),
    Date.now(),
  );
}

/** Forces the next read to miss. Used by an explicit "refresh" tap. */
export async function invalidate(type: RequestType, placeId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM places_cache WHERE cache_key = ?`, key(type, placeId));
}

/** Drops entries older than the TTL. Not required for correctness — `read`
 *  already treats them as misses — but keeps the table from growing forever. */
export async function prune(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM places_cache WHERE fetched_at < ?`, Date.now() - CACHE_TTL_MS);
}

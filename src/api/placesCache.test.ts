import { type Db, openTestDb, setDbForTesting } from '../db/client';
import { CACHE_TTL_MS, invalidate, prune, read, write } from './placesCache';

/**
 * The cache is the app's main defence against the Places bill, so its TTL and
 * its stale-fallback behaviour are worth pinning down.
 */

let db: Db;

beforeEach(async () => {
  db = await openTestDb();
  setDbForTesting(db);
});

afterEach(async () => {
  setDbForTesting(null);
  jest.useRealTimers();
  await db.closeAsync();
});

/** Backdates a cache row so it looks older than it is. */
async function ageEntry(placeId: string, ageMs: number) {
  await db.runAsync(
    `UPDATE places_cache SET fetched_at = ? WHERE cache_key = ?`,
    Date.now() - ageMs,
    `details:${placeId}`,
  );
}

describe('placesCache', () => {
  it('round-trips a value', async () => {
    await write('details', 'place-1', { name: 'India Gate' });
    const hit = await read<{ name: string }>('details', 'place-1');
    expect(hit?.value).toEqual({ name: 'India Gate' });
    expect(hit?.stale).toBe(false);
  });

  it('misses for an unknown key', async () => {
    expect(await read('details', 'nope')).toBeNull();
  });

  it('keys details and nearby separately for the same place', async () => {
    await write('details', 'place-1', { kind: 'details' });
    await write('nearby', 'place-1', { kind: 'nearby' });

    expect((await read<{ kind: string }>('details', 'place-1'))?.value.kind).toBe('details');
    expect((await read<{ kind: string }>('nearby', 'place-1'))?.value.kind).toBe('nearby');
  });

  it('overwrites rather than duplicating on a second write', async () => {
    await write('details', 'place-1', { rating: 4.5 });
    await write('details', 'place-1', { rating: 4.7 });

    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM places_cache`,
    );
    expect(row?.count).toBe(1);
    expect((await read<{ rating: number }>('details', 'place-1'))?.value.rating).toBe(4.7);
  });

  it('serves an entry one day short of the TTL', async () => {
    await write('details', 'place-1', { name: 'India Gate' });
    await ageEntry('place-1', CACHE_TTL_MS - 24 * 60 * 60 * 1000);
    expect(await read('details', 'place-1')).not.toBeNull();
  });

  it('treats an entry past the TTL as a miss', async () => {
    await write('details', 'place-1', { name: 'India Gate' });
    await ageEntry('place-1', CACHE_TTL_MS + 1000);
    expect(await read('details', 'place-1')).toBeNull();
  });

  it('returns an expired entry when explicitly allowed, flagged stale', async () => {
    // This is the offline path: a month-old address beats no address at all.
    await write('details', 'place-1', { name: 'India Gate' });
    await ageEntry('place-1', CACHE_TTL_MS + 1000);

    const hit = await read<{ name: string }>('details', 'place-1', { allowStale: true });
    expect(hit?.value).toEqual({ name: 'India Gate' });
    expect(hit?.stale).toBe(true);
  });

  it('drops the entry on invalidate, so a refresh really refetches', async () => {
    await write('nearby', 'place-1', []);
    await invalidate('nearby', 'place-1');
    expect(await read('nearby', 'place-1', { allowStale: true })).toBeNull();
  });

  it('discards a corrupt row instead of failing forever', async () => {
    await write('details', 'place-1', { name: 'India Gate' });
    await db.runAsync(
      `UPDATE places_cache SET payload = ? WHERE cache_key = ?`,
      '{not json',
      'details:place-1',
    );

    expect(await read('details', 'place-1')).toBeNull();
    // Gone, so the next call refetches rather than hitting the same bad row.
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM places_cache`,
    );
    expect(row?.count).toBe(0);
  });

  it('prunes only expired entries', async () => {
    await write('details', 'fresh', { a: 1 });
    await write('details', 'old', { a: 2 });
    await ageEntry('old', CACHE_TTL_MS + 1000);

    await prune();

    expect(await read('details', 'fresh')).not.toBeNull();
    expect(await read('details', 'old', { allowStale: true })).toBeNull();
  });
});

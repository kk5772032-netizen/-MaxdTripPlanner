import { openTestDb, openTestDbAtV1, setDbForTesting } from './client';
import { LATEST_VERSION, MIGRATIONS, migrate } from './migrations';
import { CREATE_TABLES } from './schema';

/**
 * The point of these tests is the upgrade path, not the happy path. A fresh
 * install exercises `CREATE TABLE`; only a database that already holds someone's
 * trips exercises the migrations, and that is the one that must not break.
 */

describe('migrations', () => {
  afterEach(() => setDbForTesting(null));

  it('are ordered, uniquely numbered, and start above the original schema', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(Math.min(...versions)).toBeGreaterThan(1);
  });

  it('brings a version 1 database up to the latest', async () => {
    const db = await openTestDbAtV1();
    const { from, to } = await migrate(db);
    expect(from).toBe(1);
    expect(to).toBe(LATEST_VERSION);
  });

  it('keeps existing rows, and gives them the new columns as null', async () => {
    const db = await openTestDbAtV1();
    await db.runAsync(
      `INSERT INTO trips (id, name, currency, created_at) VALUES (?, ?, ?, ?)`,
      't1', 'Delhi long weekend', 'INR', '2026-01-01T00:00:00.000Z',
    );
    await db.runAsync(
      `INSERT INTO stops (id, trip_id, name, sequence) VALUES (?, ?, ?, ?)`,
      's1', 't1', 'India Gate', 0,
    );

    await migrate(db);

    const stop = await db.getFirstAsync<{
      name: string;
      sequence: number;
      day_date: string | null;
      start_time: string | null;
    }>('SELECT name, sequence, day_date, start_time FROM stops WHERE id = ?', 's1');

    expect(stop?.name).toBe('India Gate');
    expect(stop?.sequence).toBe(0);
    // The row survived and simply isn't scheduled yet.
    expect(stop?.day_date).toBeNull();
    expect(stop?.start_time).toBeNull();
  });

  it('is idempotent — running it twice changes nothing', async () => {
    const db = await openTestDbAtV1();
    await migrate(db);
    const second = await migrate(db);
    expect(second.from).toBe(LATEST_VERSION);
    expect(second.to).toBe(LATEST_VERSION);
  });

  it('leaves a freshly created database at the latest version', async () => {
    // openTestDb is the production path: create, then migrate.
    const db = await openTestDb();
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(LATEST_VERSION);
  });

  it('creates bookings with the trip cascade intact', async () => {
    const db = await openTestDbAtV1();
    await migrate(db);
    await db.execAsync('PRAGMA foreign_keys = ON;');

    await db.runAsync(
      `INSERT INTO trips (id, name, currency, created_at) VALUES (?, ?, ?, ?)`,
      't1', 'Delhi long weekend', 'INR', '2026-01-01T00:00:00.000Z',
    );
    await db.runAsync(
      `INSERT INTO bookings (id, trip_id, kind, title, created_at) VALUES (?, ?, ?, ?, ?)`,
      'b1', 't1', 'flight', 'DEL → BOM', '2026-01-01T00:00:00.000Z',
    );

    await db.runAsync('DELETE FROM trips WHERE id = ?', 't1');
    const left = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM bookings');
    // A booking belongs to its trip and should not outlive it.
    expect(left?.n).toBe(0);
  });

  it('rejects a booking kind outside the known set', async () => {
    const db = await openTestDbAtV1();
    await migrate(db);
    await db.runAsync(
      `INSERT INTO trips (id, name, currency, created_at) VALUES (?, ?, ?, ?)`,
      't1', 'Delhi long weekend', 'INR', '2026-01-01T00:00:00.000Z',
    );
    await expect(
      db.runAsync(
        `INSERT INTO bookings (id, trip_id, kind, title, created_at) VALUES (?, ?, ?, ?, ?)`,
        'b1', 't1', 'submarine', 'Nautilus', '2026-01-01T00:00:00.000Z',
      ),
    ).rejects.toThrow();
  });
});

/** Guards the assumption the runner rests on: v1 is the original schema. */
it('the original schema still creates cleanly on its own', async () => {
  const db = await openTestDb();
  await expect(db.execAsync(CREATE_TABLES)).resolves.not.toThrow();
});

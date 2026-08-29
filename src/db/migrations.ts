import { runInTransaction, type Db } from './client';

/**
 * Ordered schema migrations.
 *
 * The first version of this app shipped with `CREATE TABLE IF NOT EXISTS` and
 * nothing else, which is fine exactly once: it can create a database but it can
 * never change one. Adding a column to an installed app was impossible, because
 * the table already existed and the create statement quietly did nothing.
 *
 * So: `PRAGMA user_version` is the source of truth for what a database has had
 * applied, and every schema change from here on is an entry in this list. A
 * migration is applied at most once, in order, inside a transaction — a half
 * applied migration would leave a database no later migration could reason
 * about.
 *
 * Rules for adding one:
 *   - Append. Never edit or renumber an existing entry; someone's phone has
 *     already run it and will not run it again.
 *   - Additive where possible. SQLite can add a column but not drop or retype
 *     one without rebuilding the table.
 *   - New columns are nullable or defaulted, so existing rows stay valid.
 */

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/** Version 1 is the original schema, in src/db/schema.ts. */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 2,
    name: 'schedule and bookings',
    sql: `
      -- A stop had a sequence but no place in time, which is why the app could
      -- not answer "what am I doing on Tuesday?".
      ALTER TABLE stops ADD COLUMN day_date TEXT;
      ALTER TABLE stops ADD COLUMN start_time TEXT;
      ALTER TABLE stops ADD COLUMN end_time TEXT;

      -- An activity was a title and a price. These make it a plannable thing.
      ALTER TABLE activities ADD COLUMN start_time TEXT;
      ALTER TABLE activities ADD COLUMN duration_min INTEGER;
      ALTER TABLE activities ADD COLUMN notes TEXT;

      -- Flights, hotels, trains and reservations: the things you need to find
      -- in a hurry, which until now had nowhere to live.
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('flight','lodging','train','bus','car','restaurant','other')),
        title TEXT NOT NULL,
        confirmation TEXT,
        starts_at TEXT,
        ends_at TEXT,
        location TEXT,
        cost INTEGER,
        notes TEXT,
        attachment_uri TEXT,
        attachment_name TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_trip_start ON bookings(trip_id, starts_at);
      CREATE INDEX IF NOT EXISTS idx_stops_trip_day ON stops(trip_id, day_date);
    `,
  },
  {
    version: 3,
    name: 'link expenses to bookings',
    sql: `
      -- A booking already knows what it cost; without this the figure has to be
      -- typed a second time to become an expense, and there is no way to tell
      -- whether it already has been.
      ALTER TABLE expenses ADD COLUMN booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_expenses_booking ON expenses(booking_id);
    `,
  },
];

/** The version a freshly created database is at once every migration has run. */
export const LATEST_VERSION = MIGRATIONS.reduce((v, m) => Math.max(v, m.version), 1);

async function readVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Brings `db` up to LATEST_VERSION, applying only what it hasn't seen.
 *
 * A brand-new database has just had the v1 schema created, so it is stamped
 * straight to 1 and then migrated forward like any other.
 */
export async function migrate(db: Db): Promise<{ from: number; to: number }> {
  const current = await readVersion(db);
  const from = current === 0 ? 1 : current;

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    // Each migration is all-or-nothing: a partial apply would leave a database
    // that no later migration could make sense of.
    await runInTransaction(db, async (tx) => {
      await tx.execAsync(migration.sql);
    });
    // PRAGMA can't be parameterised, and the value is a literal from this file.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }

  const to = await readVersion(db);
  return { from, to };
}

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
  {
    version: 4,
    name: 'packing lists',
    sql: `
      -- The two days before leaving are the app's busiest hours and it had
      -- nothing to offer them.
      CREATE TABLE IF NOT EXISTS packing_items (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        -- Free text rather than an enum: people group by their own logic, and
        -- a fixed list of categories is a fight with every one of them.
        category TEXT,
        packed INTEGER NOT NULL DEFAULT 0,
        sequence INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_packing_trip ON packing_items(trip_id, sequence);
    `,
  },
  {
    version: 5,
    name: 'second currency per trip',
    sql: `
      -- A trip is spent in one currency and thought about in another. The rate
      -- is stored as parts per million rather than a float, for the same reason
      -- money is stored in minor units: a rate of 2.34 is not representable and
      -- 2340000 is.
      ALTER TABLE trips ADD COLUMN home_currency TEXT;
      ALTER TABLE trips ADD COLUMN rate_ppm INTEGER;
    `,
  },
  {
    version: 6,
    name: 'journal entries',
    sql: `
      -- What actually happened, as opposed to what was planned. One row per day
      -- of a trip, created only when there is something to say.
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        -- ISO date. One entry per day per trip, enforced rather than trusted.
        day_date TEXT NOT NULL,
        note TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (trip_id, day_date)
      );

      CREATE TABLE IF NOT EXISTS journal_photos (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        -- A file this app copied into its own storage, not the picker's cache,
        -- which the OS is free to empty.
        uri TEXT NOT NULL,
        sequence INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_journal_photos ON journal_photos(entry_id, sequence);
    `,
  },
  {
    version: 7,
    name: 'sync metadata',
    sql: `
      -- Every row a device can change gets a stamp, so two copies of the same
      -- data can be merged without a server deciding who is right. The stamp is
      -- an HLC string, not a wall clock: see src/sync/hlc.ts.
      --
      -- Existing rows get an empty string here and are backfilled in code on
      -- first run, because SQLite cannot mint an HLC and a row that sorts
      -- before everything would lose every merge it ever entered.
      ALTER TABLE trips ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE stops ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE activities ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE food_plans ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE expenses ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE bookings ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE packing_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      -- journal_entries already had an updated_at holding an ISO instant that
      -- nothing ever displayed. It is reused rather than doubled: the backfill
      -- replaces anything that is not a stamp, which covers those too.
      ALTER TABLE journal_photos ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

      -- Without tombstones a delete cannot travel. The other device simply sees
      -- a row it has and you do not, and helpfully gives it back.
      CREATE TABLE IF NOT EXISTS deletions (
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        PRIMARY KEY (table_name, row_id)
      );
    `,
  },
  {
    version: 8,
    name: 'who is on the trip, and who paid',
    sql: `
      CREATE TABLE IF NOT EXISTS travellers (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sequence INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_travellers_trip ON travellers(trip_id, sequence);

      -- Who actually paid. Null keeps the expense out of the settle-up while
      -- leaving it in the budget, which is right for a trip nobody is splitting.
      ALTER TABLE expenses ADD COLUMN paid_by TEXT REFERENCES travellers(id) ON DELETE SET NULL;

      -- A JSON array of traveller ids, or NULL for everyone. Null rather than a
      -- join table because it is always read whole and never queried across,
      -- and because "everyone" should not require a row per person.
      ALTER TABLE expenses ADD COLUMN shared_with TEXT;
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

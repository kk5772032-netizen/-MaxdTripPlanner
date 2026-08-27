import * as SQLite from 'expo-sqlite';

import { migrate } from './migrations';
import { CREATE_TABLES } from './schema';

/**
 * Thin wrapper over expo-sqlite.
 *
 * The whole app shares one connection. Repositories call `getDb()` rather than
 * holding a reference, so tests can swap in an in-memory database via
 * `setDbForTesting`.
 */

export type Db = SQLite.SQLiteDatabase;

const DB_NAME = 'waypoint.db';

let dbPromise: Promise<Db> | null = null;

async function open(name: string, applyMigrations = true): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(name);
  // execAsync runs multiple statements; foreign_keys is per-connection so it
  // has to be set here rather than only in the schema file.
  await db.execAsync(CREATE_TABLES);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  // CREATE TABLE IF NOT EXISTS builds a new database; migrations are what let
  // an existing one change shape. Both paths run this.
  if (applyMigrations) await migrate(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = open(DB_NAME);
  }
  return dbPromise;
}

/** Opens a fresh in-memory database, migrated. Used by repository tests. */
export async function openTestDb(): Promise<Db> {
  return open(':memory:');
}

/**
 * An in-memory database holding the ORIGINAL schema, unmigrated and stamped at
 * version 1 — what an app installed before migrations existed looks like.
 * Only the migration tests want this; everything else wants openTestDb.
 */
export async function openTestDbAtV1(): Promise<Db> {
  const db = await open(':memory:', false);
  await db.execAsync('PRAGMA user_version = 1');
  return db;
}

/** Points every repository at `db`. Pass null to restore the real database. */
export function setDbForTesting(db: Db | null): void {
  dbPromise = db ? Promise.resolve(db) : null;
}

/**
 * Runs `fn` inside a transaction, rolling back if it throws.
 *
 * `withTransactionAsync` rather than the exclusive variant: exclusive opens a
 * second connection and throws outright on web ("not supported on web"), which
 * silently broke stop reordering and undo there long before anyone noticed.
 * This app has a single connection, so a plain transaction is the same
 * guarantee without the platform hole.
 */
export async function runInTransaction(db: Db, fn: (tx: Db) => Promise<void>): Promise<void> {
  await db.withTransactionAsync(async () => {
    await fn(db);
  });
}

export async function withTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await getDb();
  let result: T;
  await runInTransaction(db, async (tx) => {
    result = await fn(tx);
  });
  return result!;
}

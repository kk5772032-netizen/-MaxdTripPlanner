/**
 * A test-only stand-in for `expo-sqlite`, backed by Node's built-in
 * `node:sqlite`.
 *
 * expo-sqlite is a native module with no implementation under Jest, so
 * repository tests need something behind it. This is deliberately real SQLite
 * rather than an in-memory fake object: foreign keys, ON DELETE CASCADE / SET
 * NULL and CHECK constraints are exactly what those tests are there to verify,
 * and a hand-rolled fake would assert nothing about them.
 *
 * It implements only the slice of the expo-sqlite surface the repositories use.
 * Add methods here when a repository starts needing one.
 */

import { DatabaseSync } from 'node:sqlite';

type Params = unknown[];

/** Matches expo-sqlite's `runAsync` result. */
interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export class TestDatabase {
  private db: DatabaseSync;

  constructor(name: string) {
    this.db = new DatabaseSync(name === ':memory:' ? ':memory:' : name);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: Params): Promise<RunResult> {
    const result = this.db.prepare(sql).run(...(normalise(params) as never[]));
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  async getAllAsync<T>(sql: string, ...params: Params): Promise<T[]> {
    // node:sqlite returns null-prototype objects; spread them so tests can use
    // toEqual against plain object literals.
    return this.db
      .prepare(sql)
      .all(...(normalise(params) as never[]))
      .map((row) => ({ ...row })) as T[];
  }

  async getFirstAsync<T>(sql: string, ...params: Params): Promise<T | null> {
    const row = this.db.prepare(sql).get(...(normalise(params) as never[]));
    return row ? ({ ...row } as T) : null;
  }

  /**
   * expo-sqlite serialises these against other writers; here the database is
   * single-threaded and per-test, so a plain BEGIN/COMMIT with rollback on
   * throw has the same observable behaviour.
   */
  async withExclusiveTransactionAsync(
    fn: (tx: TestDatabase) => Promise<void>,
  ): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn(this);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

/**
 * node:sqlite only binds null, number, bigint, string, and Uint8Array.
 * `undefined` and booleans reach it from ordinary TypeScript code, so map them
 * the way expo-sqlite does.
 */
function normalise(params: Params): unknown[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

export async function openDatabaseAsync(name: string): Promise<TestDatabase> {
  return new TestDatabase(name);
}

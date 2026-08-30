import { getDb } from '../db/client';
import { stamp } from './clock';

/**
 * Marking a write so it can be merged later.
 *
 * Two things happen on every change to a syncable row: it gets a stamp, and a
 * delete leaves a tombstone behind. Both are cheap; the alternative is a merge
 * that cannot tell a new row from an old one, or that resurrects everything
 * anyone has ever deleted.
 *
 * These are deliberately separate small functions rather than a wrapper around
 * every query. The repositories each own bespoke SQL and hiding that behind a
 * generic writer would make the queries harder to read to save a line each.
 */

export { stamp };

/**
 * Records that a row is gone.
 *
 * `INSERT OR REPLACE` rather than plain insert: deleting, restoring by undo,
 * and deleting again is an ordinary sequence, and the last delete is the one
 * that should be remembered.
 */
export async function tombstone(table: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO deletions (table_name, row_id, deleted_at) VALUES (?, ?, ?)`,
    table,
    id,
    await stamp(),
  );
}

/**
 * Clears a tombstone, for a row that has come back.
 *
 * Undo restores the original row with its original id, so its grave has to be
 * filled in — otherwise the next merge would look at a live row with an older
 * stamp than its tombstone and delete it all over again.
 */
export async function unTombstone(table: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM deletions WHERE table_name = ? AND row_id = ?`,
    table,
    id,
  );
}

/** Every tombstone, for a snapshot. */
export async function allTombstones(): Promise<
  { table: string; id: string; deletedAt: string }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    table_name: string;
    row_id: string;
    deleted_at: string;
  }>(`SELECT * FROM deletions ORDER BY table_name, row_id`);
  return rows.map((r) => ({ table: r.table_name, id: r.row_id, deletedAt: r.deleted_at }));
}

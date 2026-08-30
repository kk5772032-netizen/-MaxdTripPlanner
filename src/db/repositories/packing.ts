import type { PackingItem } from '../../types';
import { getDb, runInTransaction } from '../client';
import { newId } from '../ids';
import { stamp, tombstone, unTombstone } from '../../sync/stamping';

interface PackingRow {
  id: string;
  trip_id: string;
  title: string;
  category: string | null;
  packed: number;
  sequence: number;
}

function toItem(row: PackingRow): PackingItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    category: row.category,
    packed: row.packed === 1,
    sequence: row.sequence,
  };
}

export type NewPackingItem = Omit<PackingItem, 'id' | 'packed' | 'sequence'> &
  Partial<Pick<PackingItem, 'packed' | 'sequence'>>;

export async function listPacking(tripId: string): Promise<PackingItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PackingRow>(
    `SELECT * FROM packing_items WHERE trip_id = ? ORDER BY sequence ASC, rowid ASC`,
    tripId,
  );
  return rows.map(toItem);
}

async function nextSequence(tripId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ next: number }>(
    `SELECT COALESCE(MAX(sequence), -1) + 1 AS next FROM packing_items WHERE trip_id = ?`,
    tripId,
  );
  return row?.next ?? 0;
}

export async function createPackingItem(input: NewPackingItem): Promise<PackingItem> {
  const db = await getDb();
  const item: PackingItem = {
    packed: false,
    sequence: await nextSequence(input.tripId),
    ...input,
    id: newId(),
  };
  await db.runAsync(
    `INSERT INTO packing_items
       (id, trip_id, title, category, packed, sequence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    item.id, item.tripId, item.title, item.category, item.packed ? 1 : 0, item.sequence,
    await stamp(),
  );
  return item;
}

/**
 * Adds a whole template at once, in one transaction: a half-applied "beach
 * trip" list is worse than none, and there is no undo for thirty separate
 * inserts that stopped in the middle.
 */
export async function addPackingItems(
  tripId: string,
  titles: { title: string; category: string | null }[],
): Promise<number> {
  if (titles.length === 0) return 0;
  const db = await getDb();
  const start = await nextSequence(tripId);

  // Adding a template twice should not produce two of everything; anything
  // already on the list by name is skipped rather than duplicated.
  const existing = new Set(
    (await listPacking(tripId)).map((i) => i.title.trim().toLowerCase()),
  );
  const fresh = titles.filter((t) => !existing.has(t.title.trim().toLowerCase()));
  if (fresh.length === 0) return 0;

  // Minted before the transaction: `stamp()` writes to the settings table, and
  // nesting that write inside this one deadlocks on some drivers.
  const marks: string[] = [];
  for (let i = 0; i < fresh.length; i++) marks.push(await stamp());

  await runInTransaction(db, async (tx) => {
    for (const [i, entry] of fresh.entries()) {
      await tx.runAsync(
        `INSERT INTO packing_items
           (id, trip_id, title, category, packed, sequence, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        newId(), tripId, entry.title, entry.category, start + i, marks[i],
      );
    }
  });
  return fresh.length;
}

export async function updatePackingItem(
  id: string,
  patch: Partial<Omit<PackingItem, 'id' | 'tripId'>>,
): Promise<PackingItem | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PackingRow>(
    `SELECT * FROM packing_items WHERE id = ?`,
    id,
  );
  if (!row) return null;

  const next: PackingItem = { ...toItem(row), ...patch };
  await db.runAsync(
    `UPDATE packing_items
        SET title = ?, category = ?, packed = ?, sequence = ?, updated_at = ?
      WHERE id = ?`,
    next.title, next.category, next.packed ? 1 : 0, next.sequence, await stamp(), id,
  );
  return next;
}

export async function deletePackingItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM packing_items WHERE id = ?`, id);
  await tombstone('packing_items', id);
}

/** Re-inserts a deleted item with its original id, so undo restores the row. */
export async function restorePackingItem(item: PackingItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO packing_items
       (id, trip_id, title, category, packed, sequence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    item.id, item.tripId, item.title, item.category, item.packed ? 1 : 0, item.sequence,
    await stamp(),
  );
  await unTombstone('packing_items', item.id);
}

/** Clears the ticks without losing the list — the same trip, packed again. */
export async function unpackAll(tripId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_items SET packed = 0, updated_at = ? WHERE trip_id = ?`,
    await stamp(),
    tripId,
  );
}

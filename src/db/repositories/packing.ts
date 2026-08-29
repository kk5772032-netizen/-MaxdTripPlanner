import type { PackingItem } from '../../types';
import { getDb, runInTransaction } from '../client';
import { newId } from '../ids';

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
    `INSERT INTO packing_items (id, trip_id, title, category, packed, sequence)
     VALUES (?, ?, ?, ?, ?, ?)`,
    item.id, item.tripId, item.title, item.category, item.packed ? 1 : 0, item.sequence,
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

  await runInTransaction(db, async (tx) => {
    for (const [i, entry] of fresh.entries()) {
      await tx.runAsync(
        `INSERT INTO packing_items (id, trip_id, title, category, packed, sequence)
         VALUES (?, ?, ?, ?, 0, ?)`,
        newId(), tripId, entry.title, entry.category, start + i,
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
    `UPDATE packing_items SET title = ?, category = ?, packed = ?, sequence = ? WHERE id = ?`,
    next.title, next.category, next.packed ? 1 : 0, next.sequence, id,
  );
  return next;
}

export async function deletePackingItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM packing_items WHERE id = ?`, id);
}

/** Re-inserts a deleted item with its original id, so undo restores the row. */
export async function restorePackingItem(item: PackingItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO packing_items (id, trip_id, title, category, packed, sequence)
     VALUES (?, ?, ?, ?, ?, ?)`,
    item.id, item.tripId, item.title, item.category, item.packed ? 1 : 0, item.sequence,
  );
}

/** Clears the ticks without losing the list — the same trip, packed again. */
export async function unpackAll(tripId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE packing_items SET packed = 0 WHERE trip_id = ?`, tripId);
}

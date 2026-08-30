import type { JournalEntry, JournalPhoto } from '../../types';
import { getDb, runInTransaction } from '../client';
import { newId } from '../ids';
import { stamp, tombstone, unTombstone } from '../../sync/stamping';

interface EntryRow {
  id: string;
  trip_id: string;
  day_date: string;
  note: string | null;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  entry_id: string;
  uri: string;
  sequence: number;
}

function toPhoto(row: PhotoRow): JournalPhoto {
  return { id: row.id, entryId: row.entry_id, uri: row.uri, sequence: row.sequence };
}

/** Every entry on a trip, photos attached, oldest day first. */
export async function listJournal(tripId: string): Promise<JournalEntry[]> {
  const db = await getDb();
  const entries = await db.getAllAsync<EntryRow>(
    `SELECT * FROM journal_entries WHERE trip_id = ? ORDER BY day_date ASC`,
    tripId,
  );
  if (entries.length === 0) return [];

  // One query for all the photos rather than one per day: a fortnight's trip
  // is fourteen round trips otherwise, on the screen you open most often.
  const photos = await db.getAllAsync<PhotoRow>(
    `SELECT p.* FROM journal_photos p
       JOIN journal_entries e ON e.id = p.entry_id
      WHERE e.trip_id = ?
      ORDER BY p.sequence ASC, p.rowid ASC`,
    tripId,
  );

  const byEntry = new Map<string, JournalPhoto[]>();
  for (const row of photos) {
    const bucket = byEntry.get(row.entry_id);
    if (bucket) bucket.push(toPhoto(row));
    else byEntry.set(row.entry_id, [toPhoto(row)]);
  }

  return entries.map((row) => ({
    id: row.id,
    tripId: row.trip_id,
    dayDate: row.day_date,
    note: row.note,
    updatedAt: row.updated_at,
    photos: byEntry.get(row.id) ?? [],
  }));
}

/**
 * The entry for a day, made if it isn't there.
 *
 * Every write to a journal goes through here, because the alternative — check
 * then insert — races with itself the moment two photos are added quickly, and
 * the unique constraint turns that race into an error the user sees.
 */
export async function entryForDay(tripId: string, dayDate: string): Promise<JournalEntry> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO journal_entries (id, trip_id, day_date, note, updated_at)
     VALUES (?, ?, ?, NULL, ?)
     ON CONFLICT (trip_id, day_date) DO NOTHING`,
    newId(), tripId, dayDate, await stamp(),
  );
  const row = await db.getFirstAsync<EntryRow>(
    `SELECT * FROM journal_entries WHERE trip_id = ? AND day_date = ?`,
    tripId, dayDate,
  );
  const photos = await db.getAllAsync<PhotoRow>(
    `SELECT * FROM journal_photos WHERE entry_id = ? ORDER BY sequence ASC, rowid ASC`,
    row!.id,
  );
  return {
    id: row!.id,
    tripId: row!.trip_id,
    dayDate: row!.day_date,
    note: row!.note,
    updatedAt: row!.updated_at,
    photos: photos.map(toPhoto),
  };
}

export async function setNote(
  tripId: string,
  dayDate: string,
  note: string | null,
): Promise<void> {
  const entry = await entryForDay(tripId, dayDate);
  const db = await getDb();
  await db.runAsync(
    `UPDATE journal_entries SET note = ?, updated_at = ? WHERE id = ?`,
    note && note.trim() ? note : null,
    await stamp(),
    entry.id,
  );
  await pruneEmpty(entry.id);
}

export async function addPhotos(
  tripId: string,
  dayDate: string,
  uris: string[],
): Promise<number> {
  if (uris.length === 0) return 0;
  const entry = await entryForDay(tripId, dayDate);
  const db = await getDb();
  const start = entry.photos.length;

  // Minted outside the transaction: `stamp()` writes to the settings table.
  const marks: string[] = [];
  for (let i = 0; i <= uris.length; i++) marks.push(await stamp());

  await runInTransaction(db, async (tx) => {
    for (const [i, uri] of uris.entries()) {
      await tx.runAsync(
        `INSERT INTO journal_photos (id, entry_id, uri, sequence, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        newId(), entry.id, uri, start + i, marks[i],
      );
    }
    await tx.runAsync(
      `UPDATE journal_entries SET updated_at = ? WHERE id = ?`,
      marks[uris.length], entry.id,
    );
  });
  return uris.length;
}

/** Returns the file's uri so the caller can delete it from disk as well. */
export async function removePhoto(photoId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PhotoRow>(
    `SELECT * FROM journal_photos WHERE id = ?`,
    photoId,
  );
  if (!row) return null;
  await db.runAsync(`DELETE FROM journal_photos WHERE id = ?`, photoId);
  await tombstone('journal_photos', photoId);
  await pruneEmpty(row.entry_id);
  return row.uri;
}

/**
 * An entry with no note and no photos is not an empty diary page — it is a row
 * nobody asked for, left behind by adding a photo and removing it again.
 */
async function pruneEmpty(entryId: string): Promise<void> {
  const db = await getDb();
  const { changes } = await db.runAsync(
    `DELETE FROM journal_entries
      WHERE id = ?
        AND (note IS NULL OR TRIM(note) = '')
        AND NOT EXISTS (SELECT 1 FROM journal_photos WHERE entry_id = ?)`,
    entryId, entryId,
  );
  // Only tombstone if a row actually went, or emptying a note would leave a
  // grave for an entry that is still there.
  if (changes > 0) await tombstone('journal_entries', entryId);
}

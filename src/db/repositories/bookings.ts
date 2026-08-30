import type { Booking, BookingKind } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';
import { stamp, tombstone, unTombstone } from '../../sync/stamping';

interface BookingRow {
  id: string;
  trip_id: string;
  kind: BookingKind;
  title: string;
  confirmation: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  cost: number | null;
  notes: string | null;
  attachment_uri: string | null;
  attachment_name: string | null;
  created_at: string;
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    tripId: row.trip_id,
    kind: row.kind,
    title: row.title,
    confirmation: row.confirmation,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    costMinor: row.cost,
    notes: row.notes,
    attachmentUri: row.attachment_uri,
    attachmentName: row.attachment_name,
    createdAt: row.created_at,
  };
}

/**
 * Only the trip, kind and title are required. A booking you half-remember —
 * "some hotel in Karol Bagh" — is still worth writing down, and demanding a
 * confirmation code before you can save one is how notes end up in another app.
 */
export type NewBooking = Omit<Booking, 'id' | 'createdAt'> &
  Partial<Pick<Booking, 'createdAt'>>;

export async function createBooking(input: NewBooking): Promise<Booking> {
  const db = await getDb();
  const booking: Booking = {
    ...input,
    id: newId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO bookings
       (id, trip_id, kind, title, confirmation, starts_at, ends_at, location, cost,
        notes, attachment_uri, attachment_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    booking.id,
    booking.tripId,
    booking.kind,
    booking.title,
    booking.confirmation,
    booking.startsAt,
    booking.endsAt,
    booking.location,
    booking.costMinor,
    booking.notes,
    booking.attachmentUri,
    booking.attachmentName,
    booking.createdAt,
    await stamp(),
  );
  return booking;
}

/**
 * Chronological, with undated bookings last.
 *
 * `starts_at IS NULL` sorts the nulls to the end rather than the beginning:
 * a booking with no time yet is the least urgent thing on the screen, but it
 * still has to be findable.
 */
export async function listBookings(tripId: string): Promise<Booking[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BookingRow>(
    `SELECT * FROM bookings
      WHERE trip_id = ?
      ORDER BY starts_at IS NULL, starts_at ASC, created_at ASC`,
    tripId,
  );
  return rows.map(toBooking);
}

export async function getBooking(id: string): Promise<Booking | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BookingRow>(`SELECT * FROM bookings WHERE id = ?`, id);
  return row ? toBooking(row) : null;
}

export async function updateBooking(
  id: string,
  patch: Partial<Omit<Booking, 'id' | 'tripId' | 'createdAt'>>,
): Promise<Booking | null> {
  const existing = await getBooking(id);
  if (!existing) return null;

  const next: Booking = { ...existing, ...patch };
  const db = await getDb();
  await db.runAsync(
    `UPDATE bookings
        SET kind = ?, title = ?, confirmation = ?, starts_at = ?, ends_at = ?,
            location = ?, cost = ?, notes = ?, attachment_uri = ?, attachment_name = ?,
            updated_at = ?
      WHERE id = ?`,
    next.kind,
    next.title,
    next.confirmation,
    next.startsAt,
    next.endsAt,
    next.location,
    next.costMinor,
    next.notes,
    next.attachmentUri,
    next.attachmentName,
    await stamp(),
    id,
  );
  return next;
}

export async function deleteBooking(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM bookings WHERE id = ?`, id);
  await tombstone('bookings', id);
}

/** Puts a deleted booking back with its original id, so undo restores links. */
export async function restoreBooking(b: Booking): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO bookings
       (id, trip_id, kind, title, confirmation, starts_at, ends_at, location, cost,
        notes, attachment_uri, attachment_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    b.id, b.tripId, b.kind, b.title, b.confirmation, b.startsAt, b.endsAt,
    b.location, b.costMinor, b.notes, b.attachmentUri, b.attachmentName, b.createdAt,
    await stamp(),
  );
  await unTombstone('bookings', b.id);
}

/** Booking counts per trip, for the trip list. */
export async function countsByTrip(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ trip_id: string; n: number }>(
    `SELECT trip_id, COUNT(*) AS n FROM bookings GROUP BY trip_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.trip_id, r.n]));
}

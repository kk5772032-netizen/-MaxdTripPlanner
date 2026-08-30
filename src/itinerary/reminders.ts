import { bookingLabels } from '../tokens';
import type { Booking } from '../types';

/**
 * What to remind someone about, and when.
 *
 * Pure, so the decisions — which bookings deserve a nudge, how far ahead, and
 * what the notification says — can be argued with in a test rather than by
 * waiting until six in the morning to see whether one arrives.
 */

export interface Reminder {
  /** Stable, so rescheduling replaces rather than duplicates. */
  id: string;
  at: Date;
  title: string;
  body: string;
}

/**
 * How long before each kind of booking to say something.
 *
 * A flight gets three hours because that is when you should be leaving for the
 * airport; a restaurant gets one because a table is around the corner and a
 * three-hour warning is just noise you learn to ignore.
 */
const LEAD_HOURS: Record<Booking['kind'], number> = {
  flight: 3,
  train: 2,
  bus: 2,
  car: 1,
  lodging: 2,
  restaurant: 1,
  other: 2,
};

/** `YYYY-MM-DDTHH:MM` in local time. Null for a date with no time on it. */
function toLocalDate(stamp: string | null): Date | null {
  const m = stamp ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(stamp) : null;
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0,
    0,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function hhmm(d: Date): string {
  const h = d.getHours();
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
}

/**
 * The reminders a booking earns.
 *
 * Two at most: the evening before, so there is time to do something about it,
 * and a lead-time nudge on the day. A booking with only a date and no time gets
 * neither — "your flight is at some point tomorrow" helps nobody, and inventing
 * a time to remind about would be worse.
 */
export function remindersFor(booking: Booking, now: Date = new Date()): Reminder[] {
  const start = toLocalDate(booking.startsAt);
  if (!start) return [];

  const kind = bookingLabels[booking.kind];
  const reference = booking.confirmation ? ` · ${booking.confirmation}` : '';
  const where = booking.location ? ` · ${booking.location}` : '';
  const out: Reminder[] = [];

  const evening = new Date(start);
  evening.setDate(evening.getDate() - 1);
  evening.setHours(21, 0, 0, 0);
  // Only when it is genuinely the night before: a 9am booking made at 11pm the
  // previous night should not fire a reminder two hours before it exists.
  if (evening.getTime() > now.getTime()) {
    out.push({
      id: `booking-eve:${booking.id}`,
      at: evening,
      title: `${kind} tomorrow at ${hhmm(start)}`,
      body: `${booking.title}${reference}`,
    });
  }

  const lead = new Date(start.getTime() - LEAD_HOURS[booking.kind] * 3_600_000);
  if (lead.getTime() > now.getTime()) {
    const hours = LEAD_HOURS[booking.kind];
    out.push({
      id: `booking-lead:${booking.id}`,
      at: lead,
      title: `${kind} in ${hours} ${hours === 1 ? 'hour' : 'hours'}`,
      body: `${booking.title}${where}${reference}`,
    });
  }

  return out;
}

/**
 * Every reminder a trip's bookings earn, soonest first.
 *
 * Capped, because a phone will only hold so many scheduled notifications and a
 * long trip with everything booked would otherwise spend that budget on the
 * back half of a fortnight nobody has reached yet.
 */
export const MAX_REMINDERS = 24;

export function remindersForTrip(bookings: Booking[], now: Date = new Date()): Reminder[] {
  return bookings
    .flatMap((b) => remindersFor(b, now))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_REMINDERS);
}

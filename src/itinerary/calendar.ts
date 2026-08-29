import { addMinutes, planByDay } from './schedule';
import { bookingLabels } from '../tokens';
import type { PlanData } from './exportPlan';
import type { Booking, Stop } from '../types';

/**
 * The trip as an `.ics` file.
 *
 * Every calendar on earth imports this format, which is the whole appeal: no
 * account to link, no OAuth screen, no permission to grant. The file goes to
 * the share sheet and Google Calendar, Apple Calendar and Outlook all know
 * what to do with it.
 *
 * Times are written as floating local times — no `Z`, no `TZID`. That is
 * deliberate for travel: a 6am flight should read 6am on the phone, and a
 * calendar entry that helpfully converts it to 1:30am because you are in
 * another timezone is exactly the wrong kind of clever. Floating times are the
 * standard's own answer for "this happens at this wall-clock time, wherever
 * you are".
 */

const PRODID = '-//Waypoint//Trip Planner//EN';

/** RFC 5545 escaping. Order matters: backslashes first, or they double up. */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Lines longer than 75 octets must be folded, and an importer that hits an
 * unfolded 400-character description does not warn — it drops the event.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

/** '2026-11-09' + '06:00' -> '20261109T060000' */
function stamp(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

/** '2026-11-09' -> '20261109', for an all-day event. */
function dayStamp(date: string): string {
  return date.replace(/-/g, '');
}

/** The day after, since an all-day DTEND is exclusive. */
function nextDay(date: string): string {
  const ms = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  return new Date(ms + 86_400_000).toISOString().slice(0, 10);
}

interface Event {
  uid: string;
  summary: string;
  location: string | null;
  description: string | null;
  /** Either a timed span or a whole day. */
  when:
    | { kind: 'timed'; start: string; end: string }
    | { kind: 'allDay'; date: string };
}

function stopEvent(stop: Stop, date: string): Event {
  const base = {
    uid: `stop-${stop.id}@waypoint`,
    summary: stop.name,
    location: stop.address,
    description: stop.notes,
  };
  if (!stop.startTime) return { ...base, when: { kind: 'allDay', date } };
  // An open-ended stop still needs a length; an hour is the least wrong guess
  // and keeps the entry from rendering as a zero-width sliver.
  const end = stop.endTime ?? addMinutes(stop.startTime, 60);
  return {
    ...base,
    when: { kind: 'timed', start: stamp(date, stop.startTime), end: stamp(date, end) },
  };
}

function bookingEvent(booking: Booking, date: string, time: string | null): Event | null {
  const base = {
    uid: `booking-${booking.id}@waypoint`,
    summary: `${bookingLabels[booking.kind]}: ${booking.title}`,
    location: booking.location,
    description: [
      booking.confirmation ? `Confirmation: ${booking.confirmation}` : null,
      booking.notes,
    ]
      .filter(Boolean)
      .join('\n') || null,
  };

  if (!time) return { ...base, when: { kind: 'allDay', date } };

  const endStamp = booking.endsAt?.length === 16 ? booking.endsAt : null;
  return {
    ...base,
    when: {
      kind: 'timed',
      start: stamp(date, time),
      // A flight with a landing time uses it; anything else gets an hour.
      end: endStamp
        ? stamp(endStamp.slice(0, 10), endStamp.slice(11, 16))
        : stamp(date, addMinutes(time, 60)),
    },
  };
}

function eventsFor(data: PlanData): Event[] {
  const events: Event[] = [];

  for (const day of planByDay(data.trip, data.stops, data.bookings)) {
    if (day.date === null) continue; // An unscheduled stop has no calendar slot.

    for (const stop of day.stops) events.push(stopEvent(stop, day.date));

    for (const entry of day.bookings) {
      // A hotel is one calendar entry spanning the stay, not two: the check-out
      // row exists so the plan reads right, and a calendar already draws a
      // multi-day event across the days it covers.
      if (entry.role === 'checkout') continue;
      const event = bookingEvent(entry.booking, day.date, entry.time);
      if (event) events.push(event);
    }
  }

  return events;
}

function serialise(event: Event, dtstamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${dtstamp}`];

  if (event.when.kind === 'timed') {
    lines.push(`DTSTART:${event.when.start}`, `DTEND:${event.when.end}`);
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${dayStamp(event.when.date)}`,
      `DTEND;VALUE=DATE:${dayStamp(nextDay(event.when.date))}`,
    );
  }

  lines.push(`SUMMARY:${esc(event.summary)}`);
  if (event.location) lines.push(`LOCATION:${esc(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`);
  lines.push('END:VEVENT');
  return lines.map(fold);
}

/**
 * Returns null when there is nothing dated to put in a calendar — a trip of
 * loose ideas produces an empty file that imports as silence, which looks
 * exactly like a bug.
 */
export function planAsIcs(data: PlanData, now = new Date()): string | null {
  const events = eventsFor(data);
  if (events.length === 0) return null;

  // DTSTAMP is a UTC instant by definition, unlike the event times.
  const dtstamp = `${now.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(data.trip.name)}`,
    ...events.flatMap((event) => serialise(event, dtstamp)),
    'END:VCALENDAR',
    // The spec requires CRLF throughout and a trailing break.
  ].join('\r\n') + '\r\n';
}

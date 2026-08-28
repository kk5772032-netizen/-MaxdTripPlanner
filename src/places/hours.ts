/**
 * Opening hours, worked out locally.
 *
 * The Places API will tell you `openNow`, but that answer is only true at the
 * instant it was computed, and this app caches place details for thirty days.
 * A cached `openNow` is a lie by the following morning, so the structured
 * `periods` are stored instead and the open/closed question is answered here,
 * from the clock, every time it is asked.
 *
 * All arithmetic happens in the *place's* local time, reconstructed from the
 * UTC offset Google returns. A café in Delhi is shut at 3am Delhi time whether
 * or not it is mid-afternoon wherever the phone happens to be.
 */

/** One end of an opening period, as Google reports it. Sunday is day 0. */
export interface HoursPoint {
  day: number;
  hour: number;
  minute: number;
}

export interface HoursPeriod {
  open: HoursPoint;
  /** Absent for a place that never closes. */
  close?: HoursPoint;
}

export interface OpeningHours {
  periods: HoursPeriod[];
  /** Google's own prose, one line per weekday, already localised. */
  weekdayDescriptions: string[];
  /** Minutes to add to UTC to get the place's local time. */
  utcOffsetMinutes: number;
}

const WEEK_MINUTES = 7 * 24 * 60;
const DAY_MINUTES = 24 * 60;

/** Where we are in the place's week, as minutes since Sunday 00:00 local. */
function weekMinutesAt(at: Date, utcOffsetMinutes: number): number {
  const local = new Date(at.getTime() + utcOffsetMinutes * 60_000);
  return (
    local.getUTCDay() * DAY_MINUTES + local.getUTCHours() * 60 + local.getUTCMinutes()
  );
}

function pointMinutes(p: HoursPoint): number {
  return p.day * DAY_MINUTES + p.hour * 60 + p.minute;
}

function toClock(weekMinutes: number): string {
  const inDay = ((weekMinutes % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES;
  const hour = Math.floor(inDay / 60) % 24;
  const minute = inDay % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export type OpenState =
  | { status: 'open'; /** HH:MM local, or null when it never closes. */ until: string | null }
  | { status: 'closed'; /** HH:MM local of the next opening, if within a week. */ opensAt: string | null }
  | { status: 'unknown' };

/**
 * Open or shut, right now, and when that changes.
 *
 * The week is treated as a 10 080-minute circle so that a period running from
 * Friday 22:00 to Saturday 02:00 is one interval rather than two broken ones —
 * bars are exactly the places people check this for.
 */
export function openState(hours: OpeningHours | null, at: Date = new Date()): OpenState {
  if (!hours || hours.periods.length === 0) return { status: 'unknown' };

  // No close time at all is Google's encoding for "open 24 hours".
  if (hours.periods.every((p) => !p.close)) return { status: 'open', until: null };

  const now = weekMinutesAt(at, hours.utcOffsetMinutes);

  let nextOpen: number | null = null;
  for (const period of hours.periods) {
    if (!period.close) continue;
    const start = pointMinutes(period.open);
    let end = pointMinutes(period.close);
    // A period that ends before it starts has wrapped past Saturday midnight.
    if (end <= start) end += WEEK_MINUTES;

    // Check this week and the next, so a wrapped period still catches an
    // early-Sunday `now` that sits before every start in the list.
    for (const t of [now, now + WEEK_MINUTES]) {
      if (t >= start && t < end) return { status: 'open', until: toClock(end) };
    }

    const wait = (start - now + WEEK_MINUTES) % WEEK_MINUTES;
    if (nextOpen === null || wait < nextOpen) nextOpen = wait;
  }

  return { status: 'closed', opensAt: nextOpen === null ? null : toClock(now + nextOpen) };
}

/**
 * Today's line from Google's own weekday prose.
 *
 * `weekdayDescriptions` starts on Monday, unlike `periods`, which starts on
 * Sunday. Getting that wrong shows Tuesday's hours on a Monday, which is worse
 * than showing nothing, so the two indexings are converted explicitly here.
 */
export function todayHours(hours: OpeningHours | null, at: Date = new Date()): string | null {
  if (!hours || hours.weekdayDescriptions.length !== 7) return null;
  const local = new Date(at.getTime() + hours.utcOffsetMinutes * 60_000);
  const mondayFirst = (local.getUTCDay() + 6) % 7;
  const line = hours.weekdayDescriptions[mondayFirst];
  if (!line) return null;
  // "Monday: 9:00 AM – 5:00 PM" — the weekday is already in the day header.
  const colon = line.indexOf(': ');
  return colon === -1 ? line : line.slice(colon + 2);
}

/** Google's 0–4 price level as the currency symbol repeated. */
export function priceLevelLabel(level: number | null, symbol: string): string | null {
  if (level === null || level < 1 || level > 4) return null;
  return symbol.repeat(level);
}

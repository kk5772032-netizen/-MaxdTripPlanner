import type { Activity, Stop, Trip } from '../types';

/**
 * Turning a bag of stops into a day-by-day plan.
 *
 * Everything here is pure and works on ISO strings — `YYYY-MM-DD` for days,
 * `HH:MM` for times. No Date arithmetic on local timezones: a trip day is a
 * calendar label, not an instant, and constructing `new Date('2026-11-06')`
 * then reading it back can land on the 5th for anyone west of UTC.
 */

/** A day of the trip, with whatever is planned on it. */
export interface DayPlan {
  /** ISO date, or null for the "not scheduled yet" bucket. */
  date: string | null;
  /** 1-based day number within the trip. Null for the unscheduled bucket. */
  dayNumber: number | null;
  stops: Stop[];
}

const DAY_MS = 86_400_000;

/** Parses YYYY-MM-DD as a UTC instant, so no local timezone can shift the day. */
function parseISODate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Every calendar day the trip covers, inclusive of both ends.
 *
 * Empty when the trip has no dates — which is a normal state, not an error:
 * people name a trip long before they know when they're going.
 */
export function tripDays(trip: Pick<Trip, 'startDate' | 'endDate'>): string[] {
  if (!trip.startDate) return [];
  const start = parseISODate(trip.startDate);
  if (start === null) return [];
  // A start date with no end is a single-day trip so far.
  const end = trip.endDate ? parseISODate(trip.endDate) : start;
  if (end === null || end < start) return [trip.startDate];

  const days: string[] = [];
  for (let ms = start; ms <= end; ms += DAY_MS) days.push(toISODate(ms));
  return days;
}

/** How many days the trip spans, or null when it has no dates. */
export function tripLengthInDays(trip: Pick<Trip, 'startDate' | 'endDate'>): number | null {
  const days = tripDays(trip);
  return days.length === 0 ? null : days.length;
}

/** Orders stops within a day: timed ones by clock, untimed after, in sequence. */
export function compareWithinDay(a: Stop, b: Stop): number {
  if (a.startTime && b.startTime) {
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.sequence - b.sequence;
  }
  // An untimed stop is "sometime today", so it sits below the scheduled ones.
  if (a.startTime) return -1;
  if (b.startTime) return 1;
  return a.sequence - b.sequence;
}

/**
 * The trip as a list of days.
 *
 * Days the trip covers always appear, even when empty — an empty Tuesday is
 * information, and it is where the "add something" affordance belongs. Stops
 * dated outside the trip's range still get a day of their own rather than
 * vanishing, because silently hiding someone's data is worse than an odd date.
 */
export function planByDay(
  trip: Pick<Trip, 'startDate' | 'endDate'>,
  stops: Stop[],
): DayPlan[] {
  const days = tripDays(trip);
  const index = new Map<string, number>(days.map((d, i) => [d, i + 1]));

  const byDate = new Map<string, Stop[]>();
  const unscheduled: Stop[] = [];
  for (const stop of stops) {
    if (!stop.dayDate) {
      unscheduled.push(stop);
      continue;
    }
    const bucket = byDate.get(stop.dayDate);
    if (bucket) bucket.push(stop);
    else byDate.set(stop.dayDate, [stop]);
  }

  // Trip days first, then any dated stop that falls outside them.
  const strays = [...byDate.keys()].filter((d) => !index.has(d)).sort();
  const ordered = [...days, ...strays];

  const plans: DayPlan[] = ordered.map((date) => ({
    date,
    dayNumber: index.get(date) ?? null,
    stops: (byDate.get(date) ?? []).slice().sort(compareWithinDay),
  }));

  if (unscheduled.length > 0) {
    plans.push({
      date: null,
      dayNumber: null,
      stops: unscheduled.slice().sort((a, b) => a.sequence - b.sequence),
    });
  }
  return plans;
}

/** "Fri 6 Nov" — short enough for a day header, unambiguous about weekday. */
export function formatDayLabel(iso: string): string {
  const ms = parseISODate(iso);
  if (ms === null) return iso;
  const d = new Date(ms);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const month = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][d.getUTCMonth()];
  return `${weekday} ${d.getUTCDate()} ${month}`;
}

/** "9:30 am". Returns null for null, so callers can skip the row entirely. */
export function formatTime(hhmm: string | null): string | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m[2]} ${suffix}`;
}

/** Adds minutes to HH:MM, clamped to the same day. Used for end times. */
export function addMinutes(hhmm: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const total = Math.min(24 * 60 - 1, Number(m[1]) * 60 + Number(m[2]) + minutes);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * The span a stop occupies, as display text: "9:30 am – 11:00 am", or just the
 * start when there's no end, or null when it isn't timed at all.
 */
export function formatSpan(stop: Pick<Stop, 'startTime' | 'endTime'>): string | null {
  const start = formatTime(stop.startTime);
  if (!start) return null;
  const end = formatTime(stop.endTime);
  return end ? `${start} – ${end}` : start;
}

/** Total planned minutes on a day, for the "about 5 hours planned" summary. */
export function plannedMinutes(activities: Activity[]): number {
  return activities.reduce((sum, a) => sum + (a.durationMin ?? 0), 0);
}

/** "4h 30m", "45m", or null when nothing is timed. */
export function formatDuration(minutes: number): string | null {
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

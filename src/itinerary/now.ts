import { dayEntries, planByDay, tripDays, type DayEntry } from './schedule';
import type { Activity, Booking, Stop, Trip } from '../types';

/**
 * Where a trip is relative to today, and what is left of the day.
 *
 * The plan screen answers "what am I doing on Tuesday?". This answers "what am
 * I doing next?", which is the question you have while standing in an airport
 * with a bag, and which the app previously made you navigate three screens to
 * find out. Everything here is pure and takes the clock as an argument.
 */

export type TripPhase =
  | { kind: 'running'; date: string; dayNumber: number; of: number }
  | { kind: 'upcoming'; daysAway: number }
  | { kind: 'past' }
  /** Named but not yet dated, which is a normal state for a trip. */
  | { kind: 'undated' };

const DAY_MS = 86_400_000;

function parseISODate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number | null {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

export function tripPhase(trip: Trip, today: string): TripPhase {
  const days = tripDays(trip);
  if (days.length === 0) return { kind: 'undated' };

  const index = days.indexOf(today);
  if (index !== -1) {
    return { kind: 'running', date: today, dayNumber: index + 1, of: days.length };
  }

  const away = daysBetween(today, days[0]);
  if (away !== null && away > 0) return { kind: 'upcoming', daysAway: away };
  return { kind: 'past' };
}

/**
 * The trip to open the app on.
 *
 * A running trip wins outright. Otherwise the one starting soonest, because a
 * trip you are about to take is the one you are thinking about; a trip with no
 * dates only surfaces when nothing else is competing, and a finished trip last
 * of all.
 */
export function currentTrip(trips: Trip[], today: string): Trip | null {
  if (trips.length === 0) return null;

  const phased = trips.map((trip) => ({ trip, phase: tripPhase(trip, today) }));

  const running = phased.find((p) => p.phase.kind === 'running');
  if (running) return running.trip;

  const upcoming = phased
    .filter((p): p is { trip: Trip; phase: Extract<TripPhase, { kind: 'upcoming' }> } =>
      p.phase.kind === 'upcoming')
    .sort((a, b) => a.phase.daysAway - b.phase.daysAway);
  if (upcoming.length > 0) return upcoming[0].trip;

  const undated = phased.find((p) => p.phase.kind === 'undated');
  if (undated) return undated.trip;

  // All in the past: the most recent, which is the one you might still be
  // logging expenses against or writing up.
  return [...trips].sort((a, b) => (a.endDate ?? '') < (b.endDate ?? '') ? 1 : -1)[0] ?? null;
}

export interface NowPlan {
  date: string;
  dayNumber: number;
  of: number;
  /** The next timed thing still to come. Null once the day's clock has run out. */
  next: DayEntry | null;
  /** Everything after `next`, timed or not. */
  later: DayEntry[];
  /** Timed things whose moment has passed. */
  earlier: DayEntry[];
  /** Unticked to-dos at today's stops. */
  todo: Activity[];
}

/**
 * What is left of today.
 *
 * "Next" is the first timed entry at or after the current time. An untimed
 * entry is never "next" — it has not claimed a moment, so promoting it to the
 * top of the screen would be the app inventing a schedule nobody set.
 */
export function planForNow(
  trip: Trip,
  stops: Stop[],
  bookings: Booking[],
  activities: Activity[],
  today: string,
  nowTime: string,
): NowPlan | null {
  const phase = tripPhase(trip, today);
  if (phase.kind !== 'running') return null;

  const day = planByDay(trip, stops, bookings).find((d) => d.date === today);
  if (!day) return null;

  const entries = dayEntries(day);
  const earlier: DayEntry[] = [];
  const later: DayEntry[] = [];
  let next: DayEntry | null = null;

  for (const entry of entries) {
    if (next === null && entry.time !== null && entry.time >= nowTime) {
      next = entry;
      continue;
    }
    if (next === null && entry.time !== null) earlier.push(entry);
    else later.push(entry);
  }

  const todayStopIds = new Set(day.stops.map((s) => s.id));
  const todo = activities.filter((a) => todayStopIds.has(a.stopId) && !a.done);

  return { date: today, dayNumber: phase.dayNumber, of: phase.of, next, later, earlier, todo };
}

/** "in 3 days", "tomorrow", "today". */
export function countdown(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  if (daysAway < 14) return `in ${daysAway} days`;
  const weeks = Math.round(daysAway / 7);
  return weeks < 9 ? `in ${weeks} weeks` : `in ${Math.round(daysAway / 30)} months`;
}

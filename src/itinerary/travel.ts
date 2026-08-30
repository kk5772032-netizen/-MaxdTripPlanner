import type { Leg } from '../api/routes';
import type { Stop } from '../types';

/**
 * Getting between stops: how long it takes, and whether the day allows for it.
 *
 * Everything here is pure. The lookups live in `api/routes.ts`; this is the
 * part that decides which pairs are worth asking about, says the answer in
 * words, and works out whether a plan is physically possible.
 */

/** A stop with coordinates. Anything typed by hand may well not have them. */
export interface Located extends Stop {
  lat: number;
  lng: number;
}

function isLocated(stop: Stop): stop is Located {
  return stop.lat !== null && stop.lng !== null;
}

export interface PairKey {
  fromId: string;
  toId: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

/**
 * Consecutive pairs on a day that could have a travel time.
 *
 * A stop with no coordinates breaks the chain rather than being skipped over:
 * claiming a drive time from the museum to the restaurant when there is an
 * unplaced stop between them would be a made-up number.
 */
export function pairsForDay(stops: Stop[]): PairKey[] {
  const pairs: PairKey[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    if (!isLocated(from) || !isLocated(to)) continue;
    pairs.push({
      fromId: from.id,
      toId: to.id,
      from: { lat: from.lat, lng: from.lng },
      to: { lat: to.lat, lng: to.lng },
    });
  }
  return pairs;
}

/** Key for a leg between two stops, so a lookup can be found again. */
export function pairId(fromId: string, toId: string): string {
  return `${fromId}>${toId}`;
}

/** "22 min drive", "1 hr 5 min drive", "8 min walk". */
export function formatTravel(leg: Leg | null): string | null {
  if (!leg) return null;
  const minutes = Math.max(1, Math.round(leg.seconds / 60));
  const word = leg.mode === 'walk' ? 'walk' : 'drive';
  if (minutes < 60) return `${minutes} min ${word}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr ${word}` : `${hours} hr ${rest} min ${word}`;
}

/**
 * "1.2 km apart" — what can be said with no API key at all, from the
 * coordinates the stops already carry. Less useful than a travel time and far
 * better than nothing.
 */
export function formatDistance(metres: number | null): string | null {
  if (metres === null || metres < 0) return null;
  if (metres < 1000) return `${Math.round(metres / 50) * 50} m apart`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km apart`;
}

/** HH:MM to minutes since midnight. */
function minutesOf(hhmm: string | null): number | null {
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export interface Overrun {
  fromId: string;
  toId: string;
  /** Minutes short. Always positive. */
  shortBy: number;
}

/**
 * Where the clock does not allow for the journey.
 *
 * Only checks pairs where both ends are timed — an untimed stop is "sometime
 * today" and cannot be late. Leaving at the end time when there is one, or the
 * start when there isn't, because a stop with no end has not claimed to occupy
 * any span.
 */
export function overruns(
  stops: Stop[],
  legs: Map<string, Leg | null>,
): Overrun[] {
  const found: Overrun[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];

    const leave = minutesOf(from.endTime ?? from.startTime);
    const arrive = minutesOf(to.startTime);
    if (leave === null || arrive === null) continue;

    const leg = legs.get(pairId(from.id, to.id));
    if (!leg) continue;

    const needed = Math.round(leg.seconds / 60);
    const available = arrive - leave;
    // A negative gap is the times themselves overlapping, which the plan
    // already shows by ordering; the travel warning is about the journey.
    if (available >= 0 && available < needed) {
      found.push({ fromId: from.id, toId: to.id, shortBy: needed - available });
    }
  }

  return found;
}

/** "Day 2 doesn't allow time to get between two of its stops." */
export function overrunSummary(found: Overrun[]): string | null {
  if (found.length === 0) return null;
  const worst = found.reduce((a, b) => (b.shortBy > a.shortBy ? b : a));
  const gap = worst.shortBy === 1 ? 'a minute' : `${worst.shortBy} minutes`;
  return found.length === 1
    ? `Tight: this day is ${gap} short for one of its journeys.`
    : `Tight: ${found.length} journeys don't fit, one by ${gap}.`;
}

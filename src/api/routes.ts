import { PlacesError, hasApiKey } from './places';
import * as cache from './placesCache';

/**
 * How long it takes to get from one stop to the next.
 *
 * This is the Routes API rather than the old Directions API, and it is billed
 * per route, so the same rules as the rest of `api/` apply harder here: the
 * field mask asks for two numbers, results are cached for thirty days, and a
 * leg that is already cached costs nothing however many times a day is
 * reopened. The pair of coordinates is rounded to about eleven metres before
 * it becomes a cache key, so nudging a pin does not buy the same answer twice.
 */

const BASE = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** Below this, driving is a silly answer and the walk time is the useful one. */
const WALKING_THRESHOLD_M = 900;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Leg {
  /** Seconds. */
  seconds: number;
  metres: number;
  mode: 'drive' | 'walk';
}

/** Metres between two points on a sphere. Free, and good to a few metres. */
export function straightLineMetres(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Five decimal places is about a metre; four is about eleven. */
function routeKey(from: LatLng, to: LatLng, mode: 'drive' | 'walk'): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}:${mode}`;
}

/**
 * Which way of travelling to ask about.
 *
 * Decided locally from the straight-line distance, which costs nothing: asking
 * Google for the driving time between two museums four hundred metres apart
 * spends money on an answer nobody wants.
 */
export function modeFor(from: LatLng, to: LatLng): 'drive' | 'walk' {
  return straightLineMetres(from, to) < WALKING_THRESHOLD_M ? 'walk' : 'drive';
}

interface RawRoute {
  routes?: { duration?: string; distanceMeters?: number }[];
}

/** Google returns durations as '1234s'. */
function toSeconds(duration: string | undefined): number | null {
  const m = duration ? /^(\d+(?:\.\d+)?)s$/.exec(duration) : null;
  return m ? Math.round(Number(m[1])) : null;
}

/**
 * One leg, cache first.
 *
 * Returns null rather than throwing when there is no key or no route: a
 * missing travel time is a line the timeline does not draw, not an error
 * anybody needs to read.
 */
export async function travelLeg(
  from: LatLng,
  to: LatLng,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Leg | null> {
  if (!hasApiKey()) return null;

  const mode = modeFor(from, to);
  const key = routeKey(from, to, mode);

  const hit = await cache.read<Leg>('route', key);
  if (hit) return hit.value;

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  if (!apiKey) return null;

  let response: Response;
  try {
    response = await fetch(BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Two numbers. Asking for the polyline or the turn list would move this
        // to a more expensive tier for data nothing renders.
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: mode === 'walk' ? 'WALK' : 'DRIVE',
        ...(mode === 'drive' ? { routingPreference: 'TRAFFIC_UNAWARE' } : {}),
      }),
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    const stale = await cache.read<Leg>('route', key, { allowStale: true });
    return stale?.value ?? null;
  }

  if (!response.ok) {
    // A 4xx here usually means the Routes API is not enabled on the key, which
    // is worth saying once in a log rather than silently showing nothing.
    console.warn('[routes] returned', response.status);
    return null;
  }

  let data: RawRoute;
  try {
    data = (await response.json()) as RawRoute;
  } catch {
    return null;
  }

  const route = data.routes?.[0];
  const seconds = toSeconds(route?.duration);
  if (seconds === null || route?.distanceMeters === undefined) return null;

  const leg: Leg = { seconds, metres: route.distanceMeters, mode };
  await cache.write('route', key, leg);
  return leg;
}

/** Re-exported so callers can tell a no-key build from a failed lookup. */
export { PlacesError };

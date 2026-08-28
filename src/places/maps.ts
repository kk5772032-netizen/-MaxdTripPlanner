import { Linking } from 'react-native';

/**
 * Handing a place over to Google Maps.
 *
 * These are the documented `api=1` universal URLs rather than the older
 * `geo:` or `comgooglemaps://` schemes. On a phone with Google Maps installed
 * the OS routes them straight into the app; everywhere else — a desktop
 * browser, a phone without it — they open the same place on the web. One URL,
 * no platform branching, and nothing that can dead-end on a device that
 * doesn't have the app.
 *
 * Identifying the place is a fallback chain, because a stop can be any of
 * three things: picked from Places (a place id, which Maps resolves exactly),
 * dropped on the map (coordinates), or typed by hand (just a name, which is
 * still enough for Maps to search on).
 */

export interface MapPlace {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
}

const BASE = 'https://www.google.com/maps';

/** What Maps should search for when there is no place id. */
function query(place: MapPlace): string {
  if (place.lat !== null && place.lng !== null) return `${place.lat},${place.lng}`;
  // Name alone is ambiguous — "Central Park" exists in a dozen cities — so the
  // address rides along whenever we have one.
  return [place.name, place.address].filter(Boolean).join(', ');
}

/** Opens the place on the map. */
export function placeUrl(place: MapPlace): string {
  const params = new URLSearchParams({ api: '1', query: query(place) });
  if (place.googlePlaceId) params.set('query_place_id', place.googlePlaceId);
  return `${BASE}/search/?${params.toString()}`;
}

/**
 * Opens turn-by-turn directions to the place from wherever the phone is.
 *
 * No origin is given on purpose: Maps then uses the device's current location,
 * which is what "directions" means when you're standing somewhere.
 */
export function directionsUrl(place: MapPlace): string {
  const params = new URLSearchParams({ api: '1', destination: query(place) });
  if (place.googlePlaceId) params.set('destination_place_id', place.googlePlaceId);
  return `${BASE}/dir/?${params.toString()}`;
}

/**
 * Directions between two stops — the leg of the trip, not just the endpoint.
 * Falls back to plain directions when there's nothing to start from.
 */
export function legUrl(from: MapPlace | null, to: MapPlace): string {
  if (!from) return directionsUrl(to);
  const params = new URLSearchParams({
    api: '1',
    origin: query(from),
    destination: query(to),
  });
  if (from.googlePlaceId) params.set('origin_place_id', from.googlePlaceId);
  if (to.googlePlaceId) params.set('destination_place_id', to.googlePlaceId);
  return `${BASE}/dir/?${params.toString()}`;
}

/**
 * The whole route, opened in Google Maps as one trip with waypoints.
 *
 * Maps takes nine intermediate stops between an origin and a destination, so a
 * longer trip is truncated rather than refused — eleven stops opening the first
 * eleven is more useful than a button that does nothing. Returns null below two
 * stops, because a route needs somewhere to go from.
 */
export const MAX_ROUTE_STOPS = 11;

export function routeUrl(stops: MapPlace[]): string | null {
  if (stops.length < 2) return null;
  const route = stops.slice(0, MAX_ROUTE_STOPS);
  const origin = route[0];
  const destination = route[route.length - 1];
  const waypoints = route.slice(1, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: query(origin),
    destination: query(destination),
  });
  if (origin.googlePlaceId) params.set('origin_place_id', origin.googlePlaceId);
  if (destination.googlePlaceId) {
    params.set('destination_place_id', destination.googlePlaceId);
  }
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(query).join('|'));
  }
  return `${BASE}/dir/?${params.toString()}`;
}

/**
 * Best effort: a device with no browser and no Maps is a real, if rare, thing,
 * and there is nothing useful to say about it that the user doesn't already
 * know from watching nothing happen.
 */
export async function openInMaps(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    /* nothing to do */
  }
}

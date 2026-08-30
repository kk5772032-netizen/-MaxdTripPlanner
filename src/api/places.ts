import * as Crypto from 'expo-crypto';

import type { HoursPoint, OpeningHours } from '../places/hours';
import type { NearbyRestaurant, PlaceDetails, PlaceSuggestion } from '../types';
import * as cache from './placesCache';

/**
 * Thin client over the Google Places API (New) REST endpoints.
 *
 * Cost is the design constraint here, not latency:
 *
 * - Field masks are as narrow as the screen that consumes them. The API bills
 *   by SKU tier and the tier is chosen by the fields you ask for, so requesting
 *   a field you don't render is a direct waste of money.
 * - Autocomplete runs under a session token, which bills the whole
 *   type-then-select flow at the session rate instead of per keystroke.
 * - Details and Nearby responses go through a 30-day SQLite cache
 *   (`placesCache.ts`). Nearby in particular is only ever called on the first
 *   visit to a stop's food tab or on an explicit refresh — never on render.
 */

const BASE = 'https://places.googleapis.com/v1';

/** Radius for "restaurants near this stop", in metres. */
const NEARBY_RADIUS_M = 1500;
const NEARBY_MAX_RESULTS = 15;

/** Thrown for anything the caller might want to show the user. */
export class PlacesError extends Error {
  constructor(
    message: string,
    readonly kind: 'no-key' | 'network' | 'http' | 'parse',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PlacesError';
  }
}

function apiKey(): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  if (!key) {
    throw new PlacesError(
      'No Places API key. Copy .env.example to .env and set EXPO_PUBLIC_GOOGLE_PLACES_KEY.',
      'no-key',
    );
  }
  return key;
}

export function hasApiKey(): boolean {
  return !!process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
}

async function request<T>(
  path: string,
  {
    method = 'GET',
    fieldMask,
    body,
    signal,
  }: {
    method?: 'GET' | 'POST';
    fieldMask: string;
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Goog-Api-Key': apiKey(),
    'X-Goog-FieldMask': fieldMask,
  };
  if (body) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new PlacesError(
      'Could not reach Google Places. Check your connection.',
      'network',
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new PlacesError(
      `Places API returned ${response.status}. ${extractApiMessage(detail)}`.trim(),
      'http',
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new PlacesError('Places API returned a response we could not read.', 'parse');
  }
}

function extractApiMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? '';
  } catch {
    return '';
  }
}

/* -------------------------------------------------------------------------- */
/* Session tokens                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One token covers a whole "type, then pick a result" flow. Google bills those
 * keystrokes as a single session as long as the token is reused for the
 * autocomplete calls and then passed to the Details call that follows.
 *
 * Call `newSessionToken()` when a search screen mounts and again after each
 * selection — a token must not be reused across two selections.
 */
export function newSessionToken(): string {
  return Crypto.randomUUID();
}

/* -------------------------------------------------------------------------- */
/* Autocomplete                                                               */
/* -------------------------------------------------------------------------- */

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }[];
}

/**
 * Autocomplete is not cached: the whole point is that it reflects what the user
 * is typing right now, and it's already the cheapest call in the API when run
 * under a session token.
 */
export async function autocomplete(
  input: string,
  {
    sessionToken,
    signal,
    origin,
  }: { sessionToken: string; signal?: AbortSignal; origin?: { lat: number; lng: number } },
): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const data = await request<AutocompleteResponse>('/places:autocomplete', {
    method: 'POST',
    // Autocomplete ignores X-Goog-FieldMask, but sending it keeps every call in
    // this file consistent about declaring what it uses.
    fieldMask: 'suggestions.placePrediction',
    body: {
      input: trimmed,
      sessionToken,
      ...(origin
        ? {
            locationBias: {
              circle: {
                center: { latitude: origin.lat, longitude: origin.lng },
                radius: 50_000,
              },
            },
          }
        : {}),
    },
    signal,
  });

  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({
      placeId: p.placeId,
      primaryText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? 'Unknown place',
      secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

/* -------------------------------------------------------------------------- */
/* Place Details                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Exactly the fields the stop screen renders — nothing more.
 *
 * Field masks pick the billing tier, so an unused field is money burnt. Every
 * name past `photos` here is an Enterprise-tier field, and `rating` already put
 * this call in that tier, so the hours, review count, price, phone and site
 * ride along at no extra cost. Anything that would push it to Enterprise+
 * (reviews, atmosphere signals) is deliberately absent.
 */
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'utcOffsetMinutes',
  'photos',
  'rating',
  'userRatingCount',
  'priceLevel',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'websiteUri',
].join(',');

/** Enough for a strip you can swipe, few enough to stay under the photo bill. */
const MAX_PHOTOS = 6;

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  photos?: { name?: string }[];
  priceLevel?: string;
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  utcOffsetMinutes?: number;
  regularOpeningHours?: {
    periods?: { open?: HoursPoint; close?: HoursPoint }[];
    weekdayDescriptions?: string[];
  };
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

function toPlaceDetails(raw: RawPlace, fallbackId: string): PlaceDetails {
  const photoRefs = (raw.photos ?? [])
    .map((p) => p.name)
    .filter((name): name is string => !!name)
    .slice(0, MAX_PHOTOS);

  return {
    placeId: raw.id ?? fallbackId,
    name: raw.displayName?.text ?? 'Unknown place',
    address: raw.formattedAddress ?? null,
    lat: raw.location?.latitude ?? null,
    lng: raw.location?.longitude ?? null,
    rating: raw.rating ?? null,
    userRatingCount: raw.userRatingCount ?? null,
    priceLevel: toPriceLevel(raw.priceLevel),
    photoRef: photoRefs[0] ?? null,
    photoRefs,
    hours: toOpeningHours(raw),
    phone: raw.nationalPhoneNumber ?? null,
    website: raw.websiteUri ?? null,
  };
}

/**
 * Hours are only usable if we know where the place is in time — without an
 * offset every open/closed answer would be computed against the phone's clock,
 * so an offset-less response is treated as having no hours at all.
 */
function toOpeningHours(raw: RawPlace): OpeningHours | null {
  const hours = raw.regularOpeningHours;
  if (!hours || raw.utcOffsetMinutes === undefined) return null;

  const periods = (hours.periods ?? [])
    .filter((p): p is { open: HoursPoint; close?: HoursPoint } => !!p.open)
    .map((p) => ({ open: p.open, ...(p.close ? { close: p.close } : {}) }));
  if (periods.length === 0) return null;

  return {
    periods,
    weekdayDescriptions: hours.weekdayDescriptions ?? [],
    utcOffsetMinutes: raw.utcOffsetMinutes,
  };
}

/**
 * Fills in fields that a cache entry written by an older build won't have.
 * Thirty-day entries outlive releases, and a missing `photoRefs` would be an
 * undefined array the gallery then tries to map over.
 */
function normaliseCached(value: PlaceDetails): PlaceDetails {
  return {
    ...value,
    userRatingCount: value.userRatingCount ?? null,
    priceLevel: value.priceLevel ?? null,
    photoRefs: value.photoRefs ?? (value.photoRef ? [value.photoRef] : []),
    hours: value.hours ?? null,
    phone: value.phone ?? null,
    website: value.website ?? null,
  };
}

/**
 * Cached for 30 days. On a network failure a stale cache entry is returned
 * rather than throwing — a slightly old address beats no stop at all.
 */
export async function placeDetails(
  placeId: string,
  { sessionToken, forceRefresh = false }: { sessionToken?: string; forceRefresh?: boolean } = {},
): Promise<PlaceDetails> {
  if (!forceRefresh) {
    const hit = await cache.read<PlaceDetails>('details', placeId);
    if (hit) return normaliseCached(hit.value);
  }

  try {
    const raw = await request<RawPlace>(
      `/places/${encodeURIComponent(placeId)}${
        sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : ''
      }`,
      { fieldMask: DETAILS_FIELD_MASK },
    );
    const details = toPlaceDetails(raw, placeId);
    await cache.write('details', placeId, details);
    return details;
  } catch (e) {
    const stale = await cache.read<PlaceDetails>('details', placeId, { allowStale: true });
    if (stale) return normaliseCached(stale.value);
    throw e;
  }
}

/* -------------------------------------------------------------------------- */
/* Nearby Search                                                              */
/* -------------------------------------------------------------------------- */

// Same tier as Details: `rating` and `priceLevel` already make this an
// Enterprise call, so the hours and review count come along for free — and
// "open now" is the first thing anyone wants from a restaurant list.
const NEARBY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.utcOffsetMinutes',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.primaryTypeDisplayName',
  'places.photos',
  'places.regularOpeningHours',
].join(',');

interface NearbyResponse {
  places?: RawPlace[];
}

/** 'PRICE_LEVEL_MODERATE' -> 2. Null when Google didn't supply one. */
function toPriceLevel(value: string | undefined): number | null {
  switch (value) {
    case 'PRICE_LEVEL_FREE':
      return 0;
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1;
    case 'PRICE_LEVEL_MODERATE':
      return 2;
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4;
    default:
      return null;
  }
}

/** 'indian_restaurant' -> 'Indian'. */
function toCuisine(raw: RawPlace): string | null {
  const display = raw.primaryTypeDisplayName?.text;
  if (display) return display;
  const type = raw.primaryType;
  if (!type) return null;
  const words = type.replace(/_restaurant$/, '').split('_');
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || null;
}

export interface NearbyResult {
  restaurants: NearbyRestaurant[];
  /** Epoch ms of the underlying fetch — shown as "updated 3 days ago". */
  fetchedAt: number;
  fromCache: boolean;
  /** True when the cache entry is past its TTL and the network was unavailable. */
  stale: boolean;
}

/**
 * What a nearby search is looking for.
 *
 * Two kinds because they answer different questions and people ask them at
 * different moments — "where do we eat" on the food tab, "what else is around"
 * while planning a day. They are cached separately so one does not evict the
 * other.
 */
export type NearbyKind = 'food' | 'things';

/**
 * Google's type taxonomy is enormous; this is the part of it a traveller means
 * by "things to do". Deliberately not exhaustive — a list that includes every
 * park bench and place of worship returns noise, and the useful answer is the
 * dozen places somebody would actually cross a city for.
 */
const NEARBY_TYPES: Record<NearbyKind, string[]> = {
  food: ['restaurant'],
  things: [
    'tourist_attraction',
    'museum',
    'art_gallery',
    'historical_landmark',
    'park',
    'market',
  ],
};

/** Widened for attractions: you would travel further for a fort than a meal. */
const NEARBY_RADIUS_BY_KIND: Record<NearbyKind, number> = {
  food: NEARBY_RADIUS_M,
  things: 5_000,
};

/**
 * Places near a stop.
 *
 * Keyed on the *stop's* place id and the kind, so this is only ever called on
 * the first visit to a tab or an explicit refresh — never on render. That is
 * the single biggest lever on this app's Places bill.
 */
export async function nearbyRestaurants(
  stopPlaceId: string,
  location: { lat: number; lng: number },
  {
    forceRefresh = false,
    kind = 'food',
  }: { forceRefresh?: boolean; kind?: NearbyKind } = {},
): Promise<NearbyResult> {
  // 'food' keeps the bare place id so caches written before things-to-do
  // existed are still hits rather than a round of free re-fetching.
  const cacheKey = kind === 'food' ? stopPlaceId : `${stopPlaceId}:${kind}`;

  if (forceRefresh) {
    await cache.invalidate('nearby', cacheKey);
  } else {
    const hit = await cache.read<NearbyRestaurant[]>('nearby', cacheKey);
    if (hit) {
      return { restaurants: hit.value, fetchedAt: hit.fetchedAt, fromCache: true, stale: false };
    }
  }

  try {
    const data = await request<NearbyResponse>('/places:searchNearby', {
      method: 'POST',
      fieldMask: NEARBY_FIELD_MASK,
      body: {
        includedTypes: NEARBY_TYPES[kind],
        maxResultCount: NEARBY_MAX_RESULTS,
        rankPreference: 'POPULARITY',
        locationRestriction: {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: NEARBY_RADIUS_BY_KIND[kind],
          },
        },
      },
    });

    const restaurants: NearbyRestaurant[] = (data.places ?? []).map((raw) => ({
      ...toPlaceDetails(raw, raw.id ?? ''),
      cuisine: toCuisine(raw),
    }));

    await cache.write('nearby', cacheKey, restaurants);
    return { restaurants, fetchedAt: Date.now(), fromCache: false, stale: false };
  } catch (e) {
    const stale = await cache.read<NearbyRestaurant[]>('nearby', cacheKey, {
      allowStale: true,
    });
    if (stale) {
      return {
        restaurants: stale.value,
        fetchedAt: stale.fetchedAt,
        fromCache: true,
        stale: true,
      };
    }
    throw e;
  }
}

/* -------------------------------------------------------------------------- */
/* Photos                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Builds a photo URL from a photo resource name. This is a plain <Image> src —
 * the API key rides in the query string, which is why the Places key must be
 * restricted to Places API (New) in Cloud Console.
 *
 * Returns null when there's no photo or no key, so callers can fall back to a
 * placeholder rather than rendering a broken image.
 */
export function photoUrl(photoRef: string | null, maxWidthPx = 400): string | null {
  if (!photoRef || !hasApiKey()) return null;
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY as string;
  return `${BASE}/${photoRef}/media?maxWidthPx=${maxWidthPx}&key=${encodeURIComponent(key)}`;
}

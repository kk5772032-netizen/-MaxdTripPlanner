/**
 * Domain types.
 *
 * Money convention: every monetary value in this app is stored and passed
 * around as an INTEGER number of minor units (paise for INR, cents for USD).
 * Floats are only ever produced at the display edge by `formatMoney`. This is
 * why the fields below are named `*_minor`. See `src/budget/money.ts`.
 */

import type { OpeningHours } from './places/hours';

export type ExpenseCategory =
  | 'food'
  | 'activity'
  | 'transport'
  | 'lodging'
  | 'other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'food',
  'activity',
  'transport',
  'lodging',
  'other',
];

/** Status of spend relative to a cap. */
export type BudgetStatus = 'under' | 'near' | 'over' | 'unset';

export interface Trip {
  id: string;
  name: string;
  /** ISO date, YYYY-MM-DD. Null when the user hasn't picked dates yet. */
  startDate: string | null;
  endDate: string | null;
  /** ISO 4217 code, e.g. 'INR'. The currency the trip is spent in. */
  currency: string;
  /**
   * What you think in, when that differs from what you spend in. Null when the
   * trip needs only one currency, which is most of them.
   */
  homeCurrency: string | null;
  /**
   * How much one unit of `currency` is worth in `homeCurrency`, in parts per
   * million: 1 THB = 2.34 INR is 2_340_000. An integer for the same reason
   * money is — 2.34 is not a number a computer can hold exactly.
   */
  ratePpm: number | null;
  /** Minor units. Null means "no overall budget set". */
  totalBudgetMinor: number | null;
  createdAt: string;
}

export interface Stop {
  id: string;
  tripId: string;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photoRef: string | null;
  /** 0-based order within the trip. Also orders stops inside a day. */
  sequence: number;
  /**
   * ISO date, YYYY-MM-DD. Null means the stop is planned but not yet placed on
   * a day — a real state, not a missing value: people collect places first and
   * decide when later.
   */
  dayDate: string | null;
  /** 24-hour local time, HH:MM. Null when the day isn't planned to the hour. */
  startTime: string | null;
  endTime: string | null;
  /** The cap for this stop, in minor units. Null means "no cap set". */
  plannedBudgetMinor: number | null;
  notes: string | null;
}

export interface Activity {
  id: string;
  stopId: string;
  title: string;
  estimatedCostMinor: number | null;
  done: boolean;
  /** 24-hour local time, HH:MM. Null when it's a to-do rather than an event. */
  startTime: string | null;
  /** Minutes. Drives how tall the block is drawn on the day timeline. */
  durationMin: number | null;
  notes: string | null;
}

export interface FoodPlan {
  id: string;
  stopId: string;
  /** Null when the entry was typed by hand rather than picked from Places. */
  googlePlaceId: string | null;
  name: string;
  cuisine: string | null;
  estimatedCostMinor: number | null;
  notes: string | null;
}

export interface Expense {
  id: string;
  tripId: string;
  /** Null for trip-level expenses such as flights. */
  stopId: string | null;
  category: ExpenseCategory;
  amountMinor: number;
  note: string | null;
  /** ISO date, YYYY-MM-DD. */
  spentAt: string;
  /**
   * Set when this expense was logged from a booking, so the booking can show
   * that it is already paid for rather than offering to log it twice.
   */
  bookingId: string | null;
}

export type BookingKind =
  | 'flight'
  | 'lodging'
  | 'train'
  | 'bus'
  | 'car'
  | 'restaurant'
  | 'other';

export const BOOKING_KINDS: BookingKind[] = [
  'flight',
  'lodging',
  'train',
  'bus',
  'car',
  'restaurant',
  'other',
];

/**
 * A reservation: the thing you need to find in ninety seconds at a check-in
 * desk. Everything except the title is optional, because a half-remembered
 * booking is still worth writing down.
 */
export interface Booking {
  id: string;
  tripId: string;
  kind: BookingKind;
  title: string;
  /** Airline record locator, hotel reference, ticket number. */
  confirmation: string | null;
  /** ISO datetime, YYYY-MM-DDTHH:MM. Null when only the day is known. */
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  costMinor: number | null;
  notes: string | null;
  /** A saved copy of the ticket or voucher, if one was attached. */
  attachmentUri: string | null;
  attachmentName: string | null;
  createdAt: string;
}

/**
 * What actually happened on a day, as opposed to what was planned.
 *
 * A trip planner that closes the moment the trip starts is half an app. One
 * entry per day, created only when there is something to say — an empty day
 * has no row, so the journal never accuses you of not writing in it.
 */
export interface JournalEntry {
  id: string;
  tripId: string;
  /** ISO date, YYYY-MM-DD. Unique within a trip. */
  dayDate: string;
  note: string | null;
  updatedAt: string;
  photos: JournalPhoto[];
}

export interface JournalPhoto {
  id: string;
  entryId: string;
  /** A file in this app's own storage, not the picker's cache. */
  uri: string;
  sequence: number;
}

/**
 * One line on a packing list.
 *
 * The category is free text because people group their own way — "carry-on",
 * "toiletries", "for the baby" — and a fixed set of categories is a fight with
 * every one of them.
 */
export interface PackingItem {
  id: string;
  tripId: string;
  title: string;
  category: string | null;
  packed: boolean;
  sequence: number;
}

/** A place as returned by the Places API, normalised to what we actually use. */
export interface PlaceSuggestion {
  placeId: string;
  /** Bolded main text, e.g. "India Gate". */
  primaryText: string;
  /** e.g. "Kartavya Path, New Delhi, Delhi, India". */
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  /** How many reviews the rating rests on. 4.8 from six people is not 4.8. */
  userRatingCount: number | null;
  /** Google's 0–4 price level, when present. */
  priceLevel: number | null;
  /** Places API photo resource name, e.g. "places/ABC/photos/XYZ". */
  photoRef: string | null;
  /** The first few photos, for the gallery on a stop. Includes `photoRef`. */
  photoRefs: string[];
  /**
   * Structured hours, so open-or-shut can be recomputed from the clock rather
   * than trusting a cached `openNow`. See `src/places/hours.ts`.
   */
  hours: OpeningHours | null;
  phone: string | null;
  website: string | null;
}

/** A restaurant from Nearby Search. */
export interface NearbyRestaurant extends PlaceDetails {
  /** Primary type label, e.g. "indian_restaurant" -> "Indian". */
  cuisine: string | null;
}

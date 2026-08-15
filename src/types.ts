/**
 * Domain types.
 *
 * Money convention: every monetary value in this app is stored and passed
 * around as an INTEGER number of minor units (paise for INR, cents for USD).
 * Floats are only ever produced at the display edge by `formatMoney`. This is
 * why the fields below are named `*_minor`. See `src/budget/money.ts`.
 */

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
  /** ISO 4217 code, e.g. 'INR'. */
  currency: string;
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
  /** 0-based order within the trip. */
  sequence: number;
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
  /** Places API photo resource name, e.g. "places/ABC/photos/XYZ". */
  photoRef: string | null;
}

/** A restaurant from Nearby Search. */
export interface NearbyRestaurant extends PlaceDetails {
  /** Primary type label, e.g. "indian_restaurant" -> "Indian". */
  cuisine: string | null;
  /** Google's 0–4 price level, when present. */
  priceLevel: number | null;
}

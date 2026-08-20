import { create } from 'zustand';

import * as expensesRepo from '../db/repositories/expenses';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import type { Trip } from '../types';

/**
 * The trip *list*. Kept separate from `tripStore` (which holds the one open
 * trip and its stops) so the list screen doesn't re-render when a stop deep
 * inside a trip changes.
 *
 * Every action writes through to SQLite first, then updates local state — the
 * database is the source of truth, this is just what's on screen.
 */
interface TripsState {
  trips: Trip[];
  /** Logged spend per trip id, for the budget ring on each card. */
  actualByTrip: Record<string, number>;
  /** Stop count per trip id, shown on each card. */
  stopCountByTrip: Record<string, number>;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (input: tripsRepo.NewTrip) => Promise<Trip>;
  update: (id: string, patch: Partial<tripsRepo.NewTrip>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTripsStore = create<TripsState>((set, get) => ({
  trips: [],
  actualByTrip: {},
  stopCountByTrip: {},
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [trips, actualByTrip, stopCountByTrip] = await Promise.all([
        tripsRepo.listTrips(),
        expensesRepo.totalsByTrip(),
        stopsRepo.countsByTrip(),
      ]);
      set({ trips, actualByTrip, stopCountByTrip, loading: false });
    } catch (e) {
      // The underlying message is a SQLite string ("no such table: trips") —
      // useful in a log, meaningless and alarming on screen.
      console.warn('[trips] load failed', e);
      set({
        error: 'Something went wrong reading your trips from this device. Pull to try again.',
        loading: false,
      });
    }
  },

  create: async (input) => {
    const trip = await tripsRepo.createTrip(input);
    // Re-read rather than unshifting: the list is sorted by start date, and the
    // new trip may not belong at the top.
    set({ trips: await tripsRepo.listTrips() });
    return trip;
  },

  update: async (id, patch) => {
    await tripsRepo.updateTrip(id, patch);
    set({ trips: await tripsRepo.listTrips() });
  },

  remove: async (id) => {
    await tripsRepo.deleteTrip(id);
    const { [id]: _spend, ...actualByTrip } = get().actualByTrip;
    const { [id]: _stops, ...stopCountByTrip } = get().stopCountByTrip;
    set({ trips: get().trips.filter((t) => t.id !== id), actualByTrip, stopCountByTrip });
  },
}));

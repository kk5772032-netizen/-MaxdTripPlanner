import { create } from 'zustand';

import * as expensesRepo from '../db/repositories/expenses';
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
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [trips, actualByTrip] = await Promise.all([
        tripsRepo.listTrips(),
        expensesRepo.totalsByTrip(),
      ]);
      set({ trips, actualByTrip, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
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
    const { [id]: _removed, ...actualByTrip } = get().actualByTrip;
    set({ trips: get().trips.filter((t) => t.id !== id), actualByTrip });
  },
}));

import { create } from 'zustand';

import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import type { Stop, Trip } from '../types';

/**
 * The currently open trip and its stops.
 *
 * Actions write through to SQLite and then update local state. There's no
 * cache-invalidation layer: at this scale (tens of stops, hundreds of
 * expenses) a re-read after a write costs nothing and keeps the two copies
 * from drifting.
 */
interface TripState {
  tripId: string | null;
  trip: Trip | null;
  stops: Stop[];
  loading: boolean;
  error: string | null;

  /** Loads (or reloads) a trip. Safe to call on every focus. */
  open: (tripId: string) => Promise<void>;
  reload: () => Promise<void>;
  clear: () => void;

  addStop: (input: Omit<stopsRepo.NewStop, 'tripId'>) => Promise<Stop | null>;
  updateStop: (id: string, patch: Partial<Omit<Stop, 'id' | 'tripId'>>) => Promise<void>;
  removeStop: (id: string) => Promise<void>;
  reorderStops: (orderedIds: string[]) => Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  tripId: null,
  trip: null,
  stops: [],
  loading: false,
  error: null,

  open: async (tripId) => {
    // Only show the spinner when switching trips; a refresh of the trip
    // already on screen should not blank it out.
    const switching = get().tripId !== tripId;
    set({ tripId, loading: switching, error: null, ...(switching ? { trip: null, stops: [] } : {}) });
    try {
      const [trip, stops] = await Promise.all([
        tripsRepo.getTrip(tripId),
        stopsRepo.listStops(tripId),
      ]);
      // Guard against a slower load for a trip the user already navigated away
      // from resolving last and overwriting the current one.
      if (get().tripId !== tripId) return;
      set({ trip, stops, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  reload: async () => {
    const { tripId } = get();
    if (tripId) await get().open(tripId);
  },

  clear: () => set({ tripId: null, trip: null, stops: [], error: null }),

  addStop: async (input) => {
    const { tripId } = get();
    if (!tripId) return null;
    const stop = await stopsRepo.createStop({ ...input, tripId });
    set({ stops: [...get().stops, stop] });
    return stop;
  },

  updateStop: async (id, patch) => {
    const updated = await stopsRepo.updateStop(id, patch);
    if (!updated) return;
    set({ stops: get().stops.map((s) => (s.id === id ? updated : s)) });
  },

  removeStop: async (id) => {
    await stopsRepo.deleteStop(id);
    const { tripId } = get();
    if (tripId) set({ stops: await stopsRepo.listStops(tripId) });
  },

  reorderStops: async (orderedIds) => {
    const { tripId, stops } = get();
    if (!tripId) return;

    // Optimistic: the drag has already visually settled, so re-reading from
    // SQLite before repainting would show a frame of the old order.
    const byId = new Map(stops.map((s) => [s.id, s]));
    const next = orderedIds
      .map((id, index) => {
        const stop = byId.get(id);
        return stop ? { ...stop, sequence: index } : null;
      })
      .filter((s): s is Stop => s !== null);
    set({ stops: next });

    try {
      await stopsRepo.reorderStops(tripId, orderedIds);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), stops });
    }
  },
}));

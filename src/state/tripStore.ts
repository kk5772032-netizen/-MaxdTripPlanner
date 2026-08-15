import { create } from 'zustand';

import * as activitiesRepo from '../db/repositories/activities';
import * as expensesRepo from '../db/repositories/expenses';
import * as foodPlansRepo from '../db/repositories/foodPlans';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import type { Activity, Expense, FoodPlan, Stop, Trip } from '../types';

/**
 * The currently open trip and everything under it.
 *
 * The whole graph is loaded at once. A trip is tens of stops and hundreds of
 * expenses at the outside, so this is a few milliseconds of SQLite, and having
 * it all in memory is what lets the budget selectors be plain synchronous
 * functions over arrays.
 *
 * Actions write through to SQLite first, then update local state — the
 * database is the source of truth and this is what's on screen.
 */
interface TripState {
  tripId: string | null;
  trip: Trip | null;
  stops: Stop[];
  activities: Activity[];
  foodPlans: FoodPlan[];
  expenses: Expense[];
  loading: boolean;
  error: string | null;

  open: (tripId: string) => Promise<void>;
  reload: () => Promise<void>;
  clear: () => void;

  addStop: (input: Omit<stopsRepo.NewStop, 'tripId'>) => Promise<Stop | null>;
  updateStop: (id: string, patch: Partial<Omit<Stop, 'id' | 'tripId'>>) => Promise<void>;
  removeStop: (id: string) => Promise<void>;
  reorderStops: (orderedIds: string[]) => Promise<void>;

  addActivity: (input: activitiesRepo.NewActivity) => Promise<void>;
  updateActivity: (id: string, patch: Partial<Omit<Activity, 'id' | 'stopId'>>) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;

  addFoodPlan: (input: foodPlansRepo.NewFoodPlan) => Promise<void>;
  updateFoodPlan: (id: string, patch: Partial<Omit<FoodPlan, 'id' | 'stopId'>>) => Promise<void>;
  removeFoodPlan: (id: string) => Promise<void>;

  addExpense: (input: Omit<expensesRepo.NewExpense, 'tripId'>) => Promise<void>;
  updateExpense: (id: string, patch: Partial<Omit<Expense, 'id' | 'tripId'>>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  tripId: null,
  trip: null,
  stops: [],
  activities: [],
  foodPlans: [],
  expenses: [],
  loading: false,
  error: null,

  open: async (tripId) => {
    // Only show the spinner when switching trips; refreshing the trip already
    // on screen should not blank it out.
    const switching = get().tripId !== tripId;
    set({
      tripId,
      loading: switching,
      error: null,
      ...(switching
        ? { trip: null, stops: [], activities: [], foodPlans: [], expenses: [] }
        : {}),
    });

    try {
      const [trip, stops, activities, foodPlans, expenses] = await Promise.all([
        tripsRepo.getTrip(tripId),
        stopsRepo.listStops(tripId),
        activitiesRepo.listActivitiesForTrip(tripId),
        foodPlansRepo.listFoodPlansForTrip(tripId),
        expensesRepo.listExpenses(tripId),
      ]);
      // A slower load for a trip the user has already navigated away from must
      // not overwrite the one now on screen.
      if (get().tripId !== tripId) return;
      set({ trip, stops, activities, foodPlans, expenses, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  reload: async () => {
    const { tripId } = get();
    if (tripId) await get().open(tripId);
  },

  clear: () =>
    set({
      tripId: null,
      trip: null,
      stops: [],
      activities: [],
      foodPlans: [],
      expenses: [],
      error: null,
    }),

  /* ---------------------------------------------------------------- stops */

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
    if (!tripId) return;
    // Deleting a stop cascades to its activities and food plans and nulls the
    // stop on its expenses, so re-read rather than filtering locally.
    const [stops, activities, foodPlans, expenses] = await Promise.all([
      stopsRepo.listStops(tripId),
      activitiesRepo.listActivitiesForTrip(tripId),
      foodPlansRepo.listFoodPlansForTrip(tripId),
      expensesRepo.listExpenses(tripId),
    ]);
    set({ stops, activities, foodPlans, expenses });
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

  /* ----------------------------------------------------------- activities */

  addActivity: async (input) => {
    const activity = await activitiesRepo.createActivity(input);
    set({ activities: [...get().activities, activity] });
  },

  updateActivity: async (id, patch) => {
    const updated = await activitiesRepo.updateActivity(id, patch);
    if (!updated) return;
    set({ activities: get().activities.map((a) => (a.id === id ? updated : a)) });
  },

  removeActivity: async (id) => {
    await activitiesRepo.deleteActivity(id);
    set({ activities: get().activities.filter((a) => a.id !== id) });
  },

  /* ------------------------------------------------------------ food plans */

  addFoodPlan: async (input) => {
    const plan = await foodPlansRepo.createFoodPlan(input);
    set({ foodPlans: [...get().foodPlans, plan] });
  },

  updateFoodPlan: async (id, patch) => {
    const updated = await foodPlansRepo.updateFoodPlan(id, patch);
    if (!updated) return;
    set({ foodPlans: get().foodPlans.map((f) => (f.id === id ? updated : f)) });
  },

  removeFoodPlan: async (id) => {
    await foodPlansRepo.deleteFoodPlan(id);
    set({ foodPlans: get().foodPlans.filter((f) => f.id !== id) });
  },

  /* -------------------------------------------------------------- expenses */

  addExpense: async (input) => {
    const { tripId } = get();
    if (!tripId) return;
    const expense = await expensesRepo.createExpense({ ...input, tripId });
    set({ expenses: [expense, ...get().expenses] });
  },

  updateExpense: async (id, patch) => {
    const updated = await expensesRepo.updateExpense(id, patch);
    if (!updated) return;
    set({ expenses: get().expenses.map((e) => (e.id === id ? updated : e)) });
  },

  removeExpense: async (id) => {
    await expensesRepo.deleteExpense(id);
    set({ expenses: get().expenses.filter((e) => e.id !== id) });
  },
}));

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export function selectStop(state: TripState, stopId: string): Stop | undefined {
  return state.stops.find((s) => s.id === stopId);
}

export function selectActivities(state: TripState, stopId: string): Activity[] {
  return state.activities.filter((a) => a.stopId === stopId);
}

export function selectFoodPlans(state: TripState, stopId: string): FoodPlan[] {
  return state.foodPlans.filter((f) => f.stopId === stopId);
}

export function selectExpenses(state: TripState, stopId: string): Expense[] {
  return state.expenses.filter((e) => e.stopId === stopId);
}

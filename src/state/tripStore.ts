import { create } from 'zustand';

import * as activitiesRepo from '../db/repositories/activities';
import * as expensesRepo from '../db/repositories/expenses';
import * as foodPlansRepo from '../db/repositories/foodPlans';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import { notifyBudgetCrossing } from '../notifications';
import type { Activity, Expense, FoodPlan, Stop, Trip } from '../types';
import { useSettingsStore } from './settingsStore';
import { useToastStore } from './toastStore';

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
  /** Removes a stop and offers an undo toast that puts it back whole. */
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
      console.warn('[trip] open failed', e);
      set({ error: 'Could not open this trip. Go back and try again.', loading: false });
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
    const { tripId, stops, activities, foodPlans, expenses } = get();
    if (!tripId) return;

    // Capture the whole subtree first. Deleting cascades to activities and food
    // plans and detaches expenses, so undo has to put all four back — a toast
    // that only restores the stop would silently lose its contents.
    const stop = stops.find((s) => s.id === id);
    if (!stop) return;
    const itsActivities = activities.filter((a) => a.stopId === id);
    const itsFoodPlans = foodPlans.filter((f) => f.stopId === id);
    const detachedExpenses = expenses.filter((e) => e.stopId === id);

    await stopsRepo.deleteStop(id);
    await get().reload();

    useToastStore.getState().show({
      message: `${stop.name} removed`,
      undo: async () => {
        await stopsRepo.restoreStop(stop);
        for (const a of itsActivities) await activitiesRepo.restoreActivity(a);
        for (const f of itsFoodPlans) await foodPlansRepo.restoreFoodPlan(f);
        for (const e of detachedExpenses) await expensesRepo.restoreExpense(e);
        await get().reload();
      },
    });
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
      console.warn('[trip] reorder failed', e);
      set({ error: "Couldn't save the new order.", stops });
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
    const activity = get().activities.find((a) => a.id === id);
    await activitiesRepo.deleteActivity(id);
    set({ activities: get().activities.filter((a) => a.id !== id) });
    if (!activity) return;
    useToastStore.getState().show({
      message: `"${activity.title}" removed`,
      undo: async () => {
        await activitiesRepo.restoreActivity(activity);
        set({ activities: [...get().activities, activity] });
      },
    });
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
    const plan = get().foodPlans.find((f) => f.id === id);
    await foodPlansRepo.deleteFoodPlan(id);
    set({ foodPlans: get().foodPlans.filter((f) => f.id !== id) });
    if (!plan) return;
    useToastStore.getState().show({
      message: `${plan.name} removed from your food plan`,
      undo: async () => {
        await foodPlansRepo.restoreFoodPlan(plan);
        set({ foodPlans: [...get().foodPlans, plan] });
      },
    });
  },

  /* -------------------------------------------------------------- expenses */

  addExpense: async (input) => {
    const { tripId, trip, stops, expenses } = get();
    if (!tripId || !trip) return;

    // Totals before the write, so the alert can tell a crossing from a state.
    const beforeTripActual = expenses.reduce((sum, e) => sum + e.amountMinor, 0);
    const beforeStopActual = input.stopId
      ? expenses.filter((e) => e.stopId === input.stopId).reduce((s, e) => s + e.amountMinor, 0)
      : 0;

    const expense = await expensesRepo.createExpense({ ...input, tripId });
    set({ expenses: [expense, ...get().expenses] });
    useToastStore.getState().show({ message: 'Expense added' });

    const settings = useSettingsStore.getState();
    const stop = input.stopId ? stops.find((s) => s.id === input.stopId) : undefined;

    if (stop) {
      void notifyBudgetCrossing({
        settings, trip, scope: 'stop', name: stop.name,
        previousActual: beforeStopActual,
        actual: beforeStopActual + expense.amountMinor,
        cap: stop.plannedBudgetMinor,
      });
    }
    void notifyBudgetCrossing({
      settings, trip, scope: 'trip', name: trip.name,
      previousActual: beforeTripActual,
      actual: beforeTripActual + expense.amountMinor,
      cap: trip.totalBudgetMinor,
    });
  },

  updateExpense: async (id, patch) => {
    const updated = await expensesRepo.updateExpense(id, patch);
    if (!updated) return;
    set({ expenses: get().expenses.map((e) => (e.id === id ? updated : e)) });
  },

  removeExpense: async (id) => {
    const expense = get().expenses.find((e) => e.id === id);
    await expensesRepo.deleteExpense(id);
    set({ expenses: get().expenses.filter((e) => e.id !== id) });
    if (!expense) return;
    useToastStore.getState().show({
      message: 'Expense deleted',
      undo: async () => {
        await expensesRepo.restoreExpense(expense);
        set({ expenses: [expense, ...get().expenses] });
      },
    });
  },
}));

/* -------------------------------------------------------------------------- */
/* Narrowing helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * These take plain arrays, not the store state, and that is deliberate.
 *
 * Passing a filtering function to `useTripStore` looks natural and is a trap:
 * `filter` builds a new array every call, so useSyncExternalStore compares a
 * fresh reference each render, decides the snapshot changed, and re-renders
 * forever. Subscribe to `s.activities` and narrow the result inside a useMemo.
 */
export function activitiesForStop(activities: Activity[], stopId: string): Activity[] {
  return activities.filter((a) => a.stopId === stopId);
}

export function foodPlansForStop(foodPlans: FoodPlan[], stopId: string): FoodPlan[] {
  return foodPlans.filter((f) => f.stopId === stopId);
}

export function expensesForStop(expenses: Expense[], stopId: string): Expense[] {
  return expenses.filter((e) => e.stopId === stopId);
}

import { create } from 'zustand';

import * as activitiesRepo from '../db/repositories/activities';
import * as bookingsRepo from '../db/repositories/bookings';
import * as journalRepo from '../db/repositories/journal';
import * as packingRepo from '../db/repositories/packing';
import * as expensesRepo from '../db/repositories/expenses';
import * as foodPlansRepo from '../db/repositories/foodPlans';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import { notifyBudgetCrossing } from '../notifications';
import type {
  Activity, Booking, Expense, FoodPlan, JournalEntry, PackingItem, Stop, Trip,
} from '../types';
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
  bookings: Booking[];
  packing: PackingItem[];
  journal: JournalEntry[];
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

  setJournalNote: (dayDate: string, note: string | null) => Promise<void>;
  addJournalPhotos: (dayDate: string, uris: string[]) => Promise<void>;
  removeJournalPhoto: (photoId: string) => Promise<string | null>;

  addPacking: (input: Omit<packingRepo.NewPackingItem, 'tripId'>) => Promise<void>;
  addPackingTemplate: (
    items: { title: string; category: string | null }[],
  ) => Promise<number>;
  updatePacking: (
    id: string,
    patch: Partial<Omit<PackingItem, 'id' | 'tripId'>>,
  ) => Promise<void>;
  removePacking: (id: string) => Promise<void>;
  unpackAll: () => Promise<void>;

  addBooking: (input: Omit<bookingsRepo.NewBooking, 'tripId'>) => Promise<void>;
  updateBooking: (
    id: string,
    patch: Partial<Omit<Booking, 'id' | 'tripId' | 'createdAt'>>,
  ) => Promise<void>;
  removeBooking: (id: string) => Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  tripId: null,
  trip: null,
  stops: [],
  activities: [],
  foodPlans: [],
  expenses: [],
  bookings: [],
  packing: [],
  journal: [],
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
        ? {
            trip: null, stops: [], activities: [], foodPlans: [], expenses: [],
            bookings: [], packing: [], journal: [],
          }
        : {}),
    });

    try {
      const [trip, stops, activities, foodPlans, expenses, bookings, packing, journal] =
        await Promise.all([
        tripsRepo.getTrip(tripId),
        stopsRepo.listStops(tripId),
        activitiesRepo.listActivitiesForTrip(tripId),
        foodPlansRepo.listFoodPlansForTrip(tripId),
        expensesRepo.listExpenses(tripId),
        bookingsRepo.listBookings(tripId),
        packingRepo.listPacking(tripId),
        journalRepo.listJournal(tripId),
      ]);
      // A slower load for a trip the user has already navigated away from must
      // not overwrite the one now on screen.
      if (get().tripId !== tripId) return;
      set({
        trip, stops, activities, foodPlans, expenses, bookings, packing, journal,
        loading: false,
      });
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
      bookings: [],
      packing: [],
      journal: [],
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

  /* -------------------------------------------------------------- journal */

  setJournalNote: async (dayDate, note) => {
    const tripId = get().trip?.id;
    if (!tripId) return;
    await journalRepo.setNote(tripId, dayDate, note);
    set({ journal: await journalRepo.listJournal(tripId) });
  },

  addJournalPhotos: async (dayDate, uris) => {
    const tripId = get().trip?.id;
    if (!tripId) return;
    await journalRepo.addPhotos(tripId, dayDate, uris);
    set({ journal: await journalRepo.listJournal(tripId) });
  },

  removeJournalPhoto: async (photoId) => {
    const tripId = get().trip?.id;
    if (!tripId) return null;
    const uri = await journalRepo.removePhoto(photoId);
    set({ journal: await journalRepo.listJournal(tripId) });
    return uri;
  },

  /* -------------------------------------------------------------- packing */

  addPacking: async (input) => {
    const tripId = get().trip?.id;
    if (!tripId) return;
    const item = await packingRepo.createPackingItem({ ...input, tripId });
    set({ packing: [...get().packing, item] });
  },

  addPackingTemplate: async (items) => {
    const tripId = get().trip?.id;
    if (!tripId) return 0;
    const added = await packingRepo.addPackingItems(tripId, items);
    set({ packing: await packingRepo.listPacking(tripId) });
    return added;
  },

  updatePacking: async (id, patch) => {
    const updated = await packingRepo.updatePackingItem(id, patch);
    if (!updated) return;
    set({ packing: get().packing.map((i) => (i.id === id ? updated : i)) });
  },

  removePacking: async (id) => {
    const item = get().packing.find((i) => i.id === id);
    await packingRepo.deletePackingItem(id);
    set({ packing: get().packing.filter((i) => i.id !== id) });
    if (item) {
      useToastStore.getState().show({
        message: `Removed ${item.title}`,
        undo: async () => {
          await packingRepo.restorePackingItem(item);
          const tripId = get().trip?.id;
          if (tripId) set({ packing: await packingRepo.listPacking(tripId) });
        },
      });
    }
  },

  unpackAll: async () => {
    const tripId = get().trip?.id;
    if (!tripId) return;
    await packingRepo.unpackAll(tripId);
    set({ packing: await packingRepo.listPacking(tripId) });
  },

  /* ------------------------------------------------------------- bookings */

  addBooking: async (input) => {
    const { tripId } = get();
    if (!tripId) return;
    await bookingsRepo.createBooking({ ...input, tripId });
    // Re-read rather than append: the list is ordered by start time, and a
    // booking added last is rarely the one that happens last.
    set({ bookings: await bookingsRepo.listBookings(tripId) });
  },

  updateBooking: async (id, patch) => {
    const { tripId } = get();
    const updated = await bookingsRepo.updateBooking(id, patch);
    if (!updated || !tripId) return;
    set({ bookings: await bookingsRepo.listBookings(tripId) });
  },

  removeBooking: async (id) => {
    const booking = get().bookings.find((b) => b.id === id);
    await bookingsRepo.deleteBooking(id);
    set({ bookings: get().bookings.filter((b) => b.id !== id) });
    if (!booking) return;
    useToastStore.getState().show({
      message: `${booking.title} removed`,
      undo: async () => {
        await bookingsRepo.restoreBooking(booking);
        const { tripId } = get();
        if (tripId) set({ bookings: await bookingsRepo.listBookings(tripId) });
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

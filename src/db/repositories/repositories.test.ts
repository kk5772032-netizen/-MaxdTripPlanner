import { type Db, openTestDb, setDbForTesting } from '../client';
import * as activitiesRepo from './activities';
import * as expensesRepo from './expenses';
import * as foodPlansRepo from './foodPlans';
import * as stopsRepo from './stops';
import * as tripsRepo from './trips';

/**
 * CRUD round-trips and cascade behaviour against a real in-memory SQLite
 * database — not a mock, so foreign keys, CHECK constraints and ON DELETE
 * actually run.
 */

let db: Db;

beforeEach(async () => {
  db = await openTestDb();
  setDbForTesting(db);
});

afterEach(async () => {
  setDbForTesting(null);
  await db.closeAsync();
});

async function seedTrip() {
  return tripsRepo.createTrip({
    name: 'Delhi weekend',
    startDate: '2025-11-01',
    endDate: '2025-11-03',
    currency: 'INR',
    totalBudgetMinor: 10_000_00,
  });
}

async function seedStop(tripId: string, name = 'India Gate') {
  return stopsRepo.createStop({
    tripId,
    googlePlaceId: null,
    name,
    address: null,
    lat: null,
    lng: null,
    rating: null,
    photoRef: null,
    plannedBudgetMinor: 1_000_00,
    notes: null,
  });
}

/* ------------------------------------------------------------------- trips */

describe('trips repository', () => {
  it('round-trips a trip', async () => {
    const created = await seedTrip();
    const fetched = await tripsRepo.getTrip(created.id);
    expect(fetched).toEqual(created);
  });

  it('preserves nulls rather than coercing them', async () => {
    const trip = await tripsRepo.createTrip({
      name: 'Someday',
      startDate: null,
      endDate: null,
      currency: 'USD',
      totalBudgetMinor: null,
    });
    const fetched = await tripsRepo.getTrip(trip.id);
    expect(fetched?.startDate).toBeNull();
    expect(fetched?.totalBudgetMinor).toBeNull();
  });

  it('updates only the given fields', async () => {
    const trip = await seedTrip();
    await tripsRepo.updateTrip(trip.id, { name: 'Delhi + Agra' });
    const fetched = await tripsRepo.getTrip(trip.id);
    expect(fetched?.name).toBe('Delhi + Agra');
    expect(fetched?.currency).toBe('INR');
    expect(fetched?.totalBudgetMinor).toBe(10_000_00);
  });

  it('returns null when updating a trip that does not exist', async () => {
    expect(await tripsRepo.updateTrip('nope', { name: 'x' })).toBeNull();
  });

  it('lists trips newest-dated first', async () => {
    const a = await tripsRepo.createTrip({
      name: 'A', startDate: '2025-01-01', endDate: null, currency: 'INR', totalBudgetMinor: null,
    });
    const b = await tripsRepo.createTrip({
      name: 'B', startDate: '2025-06-01', endDate: null, currency: 'INR', totalBudgetMinor: null,
    });
    expect((await tripsRepo.listTrips()).map((t) => t.id)).toEqual([b.id, a.id]);
  });
});

/* ------------------------------------------------------------------- stops */

describe('stops repository', () => {
  it('assigns sequence numbers in insertion order', async () => {
    const trip = await seedTrip();
    const first = await seedStop(trip.id, 'India Gate');
    const second = await seedStop(trip.id, "Humayun's Tomb");
    const third = await seedStop(trip.id, 'Connaught Place');

    expect([first.sequence, second.sequence, third.sequence]).toEqual([0, 1, 2]);
    expect((await stopsRepo.listStops(trip.id)).map((s) => s.name)).toEqual([
      'India Gate',
      "Humayun's Tomb",
      'Connaught Place',
    ]);
  });

  it('numbers each trip’s stops independently', async () => {
    const tripA = await seedTrip();
    const tripB = await seedTrip();
    await seedStop(tripA.id);
    const firstOfB = await seedStop(tripB.id);
    expect(firstOfB.sequence).toBe(0);
  });

  it('rewrites sequence on reorder', async () => {
    const trip = await seedTrip();
    const a = await seedStop(trip.id, 'A');
    const b = await seedStop(trip.id, 'B');
    const c = await seedStop(trip.id, 'C');

    await stopsRepo.reorderStops(trip.id, [c.id, a.id, b.id]);

    const stops = await stopsRepo.listStops(trip.id);
    expect(stops.map((s) => s.name)).toEqual(['C', 'A', 'B']);
    expect(stops.map((s) => s.sequence)).toEqual([0, 1, 2]);
  });

  it('closes the gap in sequence when a middle stop is deleted', async () => {
    const trip = await seedTrip();
    const a = await seedStop(trip.id, 'A');
    const b = await seedStop(trip.id, 'B');
    const c = await seedStop(trip.id, 'C');

    await stopsRepo.deleteStop(b.id);

    const stops = await stopsRepo.listStops(trip.id);
    expect(stops.map((s) => s.name)).toEqual(['A', 'C']);
    // Dense, no hole where B was.
    expect(stops.map((s) => s.sequence)).toEqual([0, 1]);
    expect(stops.map((s) => s.id)).toEqual([a.id, c.id]);
  });

  it('gives the next stop the right sequence after a delete', async () => {
    const trip = await seedTrip();
    await seedStop(trip.id, 'A');
    const b = await seedStop(trip.id, 'B');
    await stopsRepo.deleteStop(b.id);

    const added = await seedStop(trip.id, 'C');
    expect(added.sequence).toBe(1);
  });

  it('round-trips coordinates and rating from Places', async () => {
    const trip = await seedTrip();
    const stop = await stopsRepo.createStop({
      tripId: trip.id,
      googlePlaceId: 'ChIJ_place_id',
      name: 'India Gate',
      address: 'Kartavya Path, New Delhi',
      lat: 28.612912,
      lng: 77.229510,
      rating: 4.6,
      photoRef: 'places/ChIJ/photos/abc',
      plannedBudgetMinor: null,
      notes: 'Best at sunset',
    });

    const fetched = await stopsRepo.getStop(stop.id);
    expect(fetched).toEqual(stop);
    expect(fetched?.lat).toBeCloseTo(28.612912, 6);
  });
});

/* -------------------------------------------------------------- activities */

describe('activities repository', () => {
  it('round-trips the done flag as a boolean', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);

    const activity = await activitiesRepo.createActivity({
      stopId: stop.id,
      title: 'Walk the memorial',
      estimatedCostMinor: 200_00,
      done: false,
    });
    expect(activity.done).toBe(false);

    await activitiesRepo.updateActivity(activity.id, { done: true });
    const [fetched] = await activitiesRepo.listActivities(stop.id);
    expect(fetched.done).toBe(true);
    expect(fetched.estimatedCostMinor).toBe(200_00);
  });

  it('lists a whole trip’s activities in itinerary order', async () => {
    const trip = await seedTrip();
    const first = await seedStop(trip.id, 'A');
    const second = await seedStop(trip.id, 'B');

    await activitiesRepo.createActivity({
      stopId: second.id, title: 'second', estimatedCostMinor: null, done: false,
    });
    await activitiesRepo.createActivity({
      stopId: first.id, title: 'first', estimatedCostMinor: null, done: false,
    });

    const all = await activitiesRepo.listActivitiesForTrip(trip.id);
    expect(all.map((a) => a.title)).toEqual(['first', 'second']);
  });
});

/* -------------------------------------------------------------- food plans */

describe('food plans repository', () => {
  it('keeps a null google_place_id for hand-typed entries', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);

    const plan = await foodPlansRepo.createFoodPlan({
      stopId: stop.id,
      googlePlaceId: null,
      name: "Karim's",
      cuisine: 'Mughlai',
      estimatedCostMinor: 600_00,
      notes: null,
    });

    const [fetched] = await foodPlansRepo.listFoodPlans(stop.id);
    expect(fetched).toEqual(plan);
    expect(fetched.googlePlaceId).toBeNull();
  });
});

/* ---------------------------------------------------------------- expenses */

describe('expenses repository', () => {
  it('round-trips a stop-level expense', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);

    const expense = await expensesRepo.createExpense({
      tripId: trip.id,
      stopId: stop.id,
      category: 'food',
      amountMinor: 450_00,
      note: 'Lunch',
      spentAt: '2025-11-01',
    });

    expect(await expensesRepo.listExpensesForStop(stop.id)).toEqual([expense]);
  });

  it('allows a trip-level expense with no stop', async () => {
    const trip = await seedTrip();
    const expense = await expensesRepo.createExpense({
      tripId: trip.id,
      stopId: null,
      category: 'transport',
      amountMinor: 8_000_00,
      note: 'Flights',
      spentAt: '2025-10-20',
    });

    expect(expense.stopId).toBeNull();
    expect(await expensesRepo.listExpenses(trip.id)).toHaveLength(1);
  });

  it('rejects a category outside the allowed set', async () => {
    const trip = await seedTrip();
    await expect(
      expensesRepo.createExpense({
        tripId: trip.id,
        stopId: null,
        // Deliberately invalid: the CHECK constraint is the last line of defence
        // if a bad value ever gets past the UI.
        category: 'souvenirs' as never,
        amountMinor: 100,
        note: null,
        spentAt: '2025-11-01',
      }),
    ).rejects.toThrow();
  });

  it('sums totals per trip in SQL', async () => {
    const tripA = await seedTrip();
    const tripB = await seedTrip();

    for (const amount of [100_00, 250_00, 33]) {
      await expensesRepo.createExpense({
        tripId: tripA.id, stopId: null, category: 'other', amountMinor: amount, note: null, spentAt: '2025-11-01',
      });
    }
    await expensesRepo.createExpense({
      tripId: tripB.id, stopId: null, category: 'other', amountMinor: 500_00, note: null, spentAt: '2025-11-01',
    });

    const totals = await expensesRepo.totalsByTrip();
    // ₹100.00 + ₹250.00 + ₹0.33, summed in paise.
    expect(totals[tripA.id]).toBe(35_033);
    expect(totals[tripB.id]).toBe(500_00);
  });
});

/* ----------------------------------------------------------------- restore */

describe('restore (undo support)', () => {
  it('puts a deleted middle stop back at its original position', async () => {
    const trip = await seedTrip();
    const a = await seedStop(trip.id, 'A');
    const b = await seedStop(trip.id, 'B');
    const c = await seedStop(trip.id, 'C');

    await stopsRepo.deleteStop(b.id);
    expect((await stopsRepo.listStops(trip.id)).map((s) => s.name)).toEqual(['A', 'C']);

    await stopsRepo.restoreStop(b);

    const stops = await stopsRepo.listStops(trip.id);
    expect(stops.map((s) => s.name)).toEqual(['A', 'B', 'C']);
    // Dense and in order — restoring has to reopen the gap that delete closed,
    // or the restored stop collides with whatever slid into its place.
    expect(stops.map((s) => s.sequence)).toEqual([0, 1, 2]);
    expect(stops.map((s) => s.id)).toEqual([a.id, b.id, c.id]);
  });

  it('restores a first and a last stop correctly too', async () => {
    const trip = await seedTrip();
    const a = await seedStop(trip.id, 'A');
    await seedStop(trip.id, 'B');
    const c = await seedStop(trip.id, 'C');

    await stopsRepo.deleteStop(a.id);
    await stopsRepo.restoreStop(a);
    expect((await stopsRepo.listStops(trip.id)).map((s) => s.name)).toEqual(['A', 'B', 'C']);

    await stopsRepo.deleteStop(c.id);
    await stopsRepo.restoreStop(c);
    const stops = await stopsRepo.listStops(trip.id);
    expect(stops.map((s) => s.name)).toEqual(['A', 'B', 'C']);
    expect(stops.map((s) => s.sequence)).toEqual([0, 1, 2]);
  });

  it('restores an expense with its original id, so links survive', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);
    const expense = await expensesRepo.createExpense({
      tripId: trip.id, stopId: stop.id, category: 'food',
      amountMinor: 450_00, note: 'Lunch', spentAt: '2025-11-01',
    });

    await expensesRepo.deleteExpense(expense.id);
    expect(await expensesRepo.listExpenses(trip.id)).toHaveLength(0);

    await expensesRepo.restoreExpense(expense);
    expect(await expensesRepo.listExpenses(trip.id)).toEqual([expense]);
  });

  it('restores a whole stop subtree — activities, food and detached expenses', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);
    const activity = await activitiesRepo.createActivity({
      stopId: stop.id, title: 'Walk', estimatedCostMinor: 200_00, done: true,
    });
    const plan = await foodPlansRepo.createFoodPlan({
      stopId: stop.id, googlePlaceId: null, name: "Karim's",
      cuisine: 'Mughlai', estimatedCostMinor: 600_00, notes: null,
    });
    const expense = await expensesRepo.createExpense({
      tripId: trip.id, stopId: stop.id, category: 'food',
      amountMinor: 450_00, note: 'Lunch', spentAt: '2025-11-01',
    });

    await stopsRepo.deleteStop(stop.id);
    // The expense survives, detached — that is the ON DELETE SET NULL rule.
    expect((await expensesRepo.listExpenses(trip.id))[0].stopId).toBeNull();

    await stopsRepo.restoreStop(stop);
    await activitiesRepo.restoreActivity(activity);
    await foodPlansRepo.restoreFoodPlan(plan);
    await expensesRepo.restoreExpense(expense);

    expect(await stopsRepo.getStop(stop.id)).toEqual(stop);
    expect(await activitiesRepo.listActivities(stop.id)).toEqual([activity]);
    expect(await foodPlansRepo.listFoodPlans(stop.id)).toEqual([plan]);
    // Re-attached to the stop it came from.
    expect((await expensesRepo.listExpenses(trip.id))[0].stopId).toBe(stop.id);
  });
});

/* ----------------------------------------------------------------- cascade */

describe('cascade behaviour', () => {
  it('deleting a trip removes its stops, activities, food plans and expenses', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);

    await activitiesRepo.createActivity({
      stopId: stop.id, title: 'Walk', estimatedCostMinor: null, done: false,
    });
    await foodPlansRepo.createFoodPlan({
      stopId: stop.id, googlePlaceId: null, name: "Karim's", cuisine: null, estimatedCostMinor: null, notes: null,
    });
    await expensesRepo.createExpense({
      tripId: trip.id, stopId: stop.id, category: 'food', amountMinor: 100_00, note: null, spentAt: '2025-11-01',
    });

    await tripsRepo.deleteTrip(trip.id);

    expect(await tripsRepo.getTrip(trip.id)).toBeNull();
    expect(await stopsRepo.listStops(trip.id)).toHaveLength(0);
    expect(await activitiesRepo.listActivities(stop.id)).toHaveLength(0);
    expect(await foodPlansRepo.listFoodPlans(stop.id)).toHaveLength(0);
    expect(await expensesRepo.listExpenses(trip.id)).toHaveLength(0);

    // Nothing orphaned anywhere in the database.
    for (const table of ['stops', 'activities', 'food_plans', 'expenses']) {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      expect(row?.count).toBe(0);
    }
  });

  it('deleting a stop removes its activities and food plans', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);

    await activitiesRepo.createActivity({
      stopId: stop.id, title: 'Walk', estimatedCostMinor: null, done: false,
    });
    await foodPlansRepo.createFoodPlan({
      stopId: stop.id, googlePlaceId: null, name: "Karim's", cuisine: null, estimatedCostMinor: null, notes: null,
    });

    await stopsRepo.deleteStop(stop.id);

    expect(await activitiesRepo.listActivities(stop.id)).toHaveLength(0);
    expect(await foodPlansRepo.listFoodPlans(stop.id)).toHaveLength(0);
  });

  it('keeps an expense when its stop is deleted, detaching it to trip level', async () => {
    const trip = await seedTrip();
    const stop = await seedStop(trip.id);

    await expensesRepo.createExpense({
      tripId: trip.id, stopId: stop.id, category: 'food', amountMinor: 450_00, note: 'Lunch', spentAt: '2025-11-01',
    });

    await stopsRepo.deleteStop(stop.id);

    // ON DELETE SET NULL: money you actually spent shouldn't vanish because you
    // reorganised the itinerary.
    const expenses = await expensesRepo.listExpenses(trip.id);
    expect(expenses).toHaveLength(1);
    expect(expenses[0].stopId).toBeNull();
    expect(expenses[0].amountMinor).toBe(450_00);
  });

  it('refuses a stop pointing at a trip that does not exist', async () => {
    await expect(seedStop('no-such-trip')).rejects.toThrow();
  });
});

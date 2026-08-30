import { getDb, openTestDb, setDbForTesting } from '../db/client';
import * as activitiesRepo from '../db/repositories/activities';
import * as bookingsRepo from '../db/repositories/bookings';
import * as expensesRepo from '../db/repositories/expenses';
import * as foodRepo from '../db/repositories/foodPlans';
import * as journalRepo from '../db/repositories/journal';
import * as packingRepo from '../db/repositories/packing';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import { resetForTesting } from './clock';
import { decode } from './hlc';

/**
 * Every write to a syncable table has to leave a stamp, and every delete a
 * tombstone. Missing one is invisible until a merge silently drops somebody's
 * edit, so this walks all of them rather than trusting that the SQL was
 * updated everywhere it needed to be.
 */

async function stampOf(table: string, id: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ updated_at: string }>(
    `SELECT updated_at FROM ${table} WHERE id = ?`,
    id,
  );
  return row?.updated_at ?? null;
}

async function graveOf(table: string, id: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ deleted_at: string }>(
    `SELECT deleted_at FROM deletions WHERE table_name = ? AND row_id = ?`,
    table,
    id,
  );
  return row?.deleted_at ?? null;
}

describe('stamping every syncable write', () => {
  let tripId: string;
  let stopId: string;

  beforeEach(async () => {
    setDbForTesting(await openTestDb());
    resetForTesting();
    const trip = await tripsRepo.createTrip({
      name: 'Delhi', startDate: '2026-11-09', endDate: '2026-11-11',
      currency: 'INR', totalBudgetMinor: null,
    });
    tripId = trip.id;
    const stop = await stopsRepo.createStop({
      tripId, name: 'Red Fort', address: null, googlePlaceId: null, lat: null, lng: null,
      rating: null, photoRef: null, plannedBudgetMinor: null, notes: null,
    });
    stopId = stop.id;
  });

  afterEach(() => {
    setDbForTesting(null);
    resetForTesting();
  });

  /**
   * One shape for all of them: create, edit, delete. Anything that fails here
   * is a table whose changes would go missing in a merge.
   */
  const cases: {
    table: string;
    create: () => Promise<string>;
    edit: (id: string) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  }[] = [
    {
      table: 'trips',
      create: async () =>
        (await tripsRepo.createTrip({
          name: 'Goa', startDate: null, endDate: null, currency: 'INR', totalBudgetMinor: null,
        })).id,
      edit: (id) => tripsRepo.updateTrip(id, { name: 'Goa again' }),
      remove: (id) => tripsRepo.deleteTrip(id),
    },
    {
      table: 'stops',
      create: async () =>
        (await stopsRepo.createStop({
          tripId, name: 'India Gate', address: null, googlePlaceId: null, lat: null,
          lng: null, rating: null, photoRef: null, plannedBudgetMinor: null, notes: null,
        })).id,
      edit: (id) => stopsRepo.updateStop(id, { notes: 'At sunset' }),
      remove: (id) => stopsRepo.deleteStop(id),
    },
    {
      table: 'activities',
      create: async () =>
        (await activitiesRepo.createActivity({
          stopId, title: 'Light show', estimatedCostMinor: null, done: false,
        })).id,
      edit: (id) => activitiesRepo.updateActivity(id, { done: true }),
      remove: (id) => activitiesRepo.deleteActivity(id),
    },
    {
      table: 'food_plans',
      create: async () =>
        (await foodRepo.createFoodPlan({
          stopId, googlePlaceId: null, name: "Karim's", cuisine: null,
          estimatedCostMinor: null, notes: null,
        })).id,
      edit: (id) => foodRepo.updateFoodPlan(id, { cuisine: 'Mughlai' }),
      remove: (id) => foodRepo.deleteFoodPlan(id),
    },
    {
      table: 'expenses',
      create: async () =>
        (await expensesRepo.createExpense({
          tripId, stopId: null, category: 'food', amountMinor: 100,
          note: null, spentAt: '2026-11-09',
        })).id,
      edit: (id) => expensesRepo.updateExpense(id, { amountMinor: 200 }),
      remove: (id) => expensesRepo.deleteExpense(id),
    },
    {
      table: 'bookings',
      create: async () =>
        (await bookingsRepo.createBooking({
          tripId, kind: 'flight', title: 'DEL to BOM', confirmation: null, startsAt: null,
          endsAt: null, location: null, costMinor: null, notes: null,
          attachmentUri: null, attachmentName: null,
        })).id,
      edit: (id) => bookingsRepo.updateBooking(id, { title: 'DEL to GOI' }),
      remove: (id) => bookingsRepo.deleteBooking(id),
    },
    {
      table: 'packing_items',
      create: async () =>
        (await packingRepo.createPackingItem({ tripId, title: 'Socks', category: null })).id,
      edit: (id) => packingRepo.updatePackingItem(id, { packed: true }),
      remove: (id) => packingRepo.deletePackingItem(id),
    },
  ];

  for (const c of cases) {
    describe(c.table, () => {
      it('stamps a new row', async () => {
        const id = await c.create();
        expect(decode((await stampOf(c.table, id))!)).not.toBeNull();
      });

      it('re-stamps an edit', async () => {
        const id = await c.create();
        const before = await stampOf(c.table, id);
        await c.edit(id);
        const after = await stampOf(c.table, id);
        expect(after! > before!).toBe(true);
      });

      it('leaves a tombstone on delete', async () => {
        const id = await c.create();
        await c.remove(id);
        expect(decode((await graveOf(c.table, id))!)).not.toBeNull();
      });
    });
  }

  describe('journal_entries', () => {
    it('stamps a note and its photos', async () => {
      await journalRepo.setNote(tripId, '2026-11-09', 'Rained');
      await journalRepo.addPhotos(tripId, '2026-11-09', ['file://a.jpg']);

      const [entry] = await journalRepo.listJournal(tripId);
      expect(decode((await stampOf('journal_entries', entry.id))!)).not.toBeNull();
      expect(decode((await stampOf('journal_photos', entry.photos[0].id))!)).not.toBeNull();
    });

    it('leaves a tombstone when a photo goes', async () => {
      await journalRepo.addPhotos(tripId, '2026-11-09', ['file://a.jpg']);
      const [entry] = await journalRepo.listJournal(tripId);
      const photoId = entry.photos[0].id;
      await journalRepo.removePhoto(photoId);
      expect(decode((await graveOf('journal_photos', photoId))!)).not.toBeNull();
    });
  });

  describe('undo', () => {
    it('fills in the grave when a row comes back', async () => {
      // Otherwise the next merge sees a live row older than its own tombstone
      // and deletes it all over again.
      const booking = await bookingsRepo.createBooking({
        tripId, kind: 'flight', title: 'DEL to BOM', confirmation: null, startsAt: null,
        endsAt: null, location: null, costMinor: null, notes: null,
        attachmentUri: null, attachmentName: null,
      });
      await bookingsRepo.deleteBooking(booking.id);
      expect(await graveOf('bookings', booking.id)).not.toBeNull();

      await bookingsRepo.restoreBooking(booking);
      expect(await graveOf('bookings', booking.id)).toBeNull();
    });
  });
});

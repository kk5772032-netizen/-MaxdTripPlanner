import { openTestDb, setDbForTesting } from '../db/client';
import * as activitiesRepo from '../db/repositories/activities';
import * as bookingsRepo from '../db/repositories/bookings';
import * as journalRepo from '../db/repositories/journal';
import * as packingRepo from '../db/repositories/packing';
import * as expensesRepo from '../db/repositories/expenses';
import * as foodRepo from '../db/repositories/foodPlans';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import { buildBackup, restoreBackup } from './backup';
import { BACKUP_KIND, backupFileName, parseBackup } from './format';

describe('parseBackup', () => {
  const good = JSON.stringify({
    kind: BACKUP_KIND,
    version: 1,
    exportedAt: '2026-08-29T00:00:00.000Z',
    trips: [{ id: 't1', name: 'Delhi' }],
  });

  it('accepts a file this app wrote', () => {
    const result = parseBackup(good);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.trips).toHaveLength(1);
  });

  it('names what is wrong rather than failing silently', () => {
    // Every one of these is something a person can actually pick in a file
    // browser, and each needs an answer they can act on.
    expect(parseBackup('not json')).toEqual({
      ok: false,
      reason: "That file isn't a Waypoint backup — it isn't even JSON.",
    });
    expect(parseBackup('{"kind":"something.else"}')).toEqual({
      ok: false,
      reason: "That file isn't a Waypoint backup.",
    });
    expect(parseBackup('[]')).toEqual({
      ok: false,
      reason: "That file isn't a Waypoint backup.",
    });
  });

  it('refuses a file from a newer version rather than guessing', () => {
    const result = parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 99, trips: [] }));
    expect(result).toEqual({
      ok: false,
      reason: 'That backup was made by a newer version of Waypoint. Update the app first.',
    });
  });

  it('rejects a damaged file before anything is written', () => {
    expect(
      parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 1, trips: 'nope' })),
    ).toEqual({ ok: false, reason: 'That backup is damaged and can’t be read.' });
    expect(
      parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 1, trips: [{ id: 1 }] })),
    ).toEqual({ ok: false, reason: 'That backup is damaged and can’t be read.' });
  });

  it('says so when there is nothing in it', () => {
    expect(parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 1, trips: [] }))).toEqual({
      ok: false,
      reason: 'That backup has no trips in it.',
    });
  });

  it('tolerates a file written before a table existed', () => {
    // An older build had no bookings and no packing list. Its files must still
    // restore rather than being rejected as damaged.
    const result = parseBackup(good);
    expect(result.ok && result.backup.bookings).toEqual([]);
    expect(result.ok && result.backup.packing).toEqual([]);
    expect(result.ok && result.backup.journal).toEqual([]);
  });
});

describe('backupFileName', () => {
  it('sorts by date and is obvious in a file list', () => {
    expect(backupFileName(new Date('2026-08-29T10:00:00Z'))).toBe(
      'waypoint-backup-2026-08-29.json',
    );
  });
});

describe('a round trip through a backup', () => {
  beforeEach(async () => {
    setDbForTesting(await openTestDb());
  });

  afterEach(() => setDbForTesting(null));

  async function seed() {
    const trip = await tripsRepo.createTrip({
      name: 'Delhi long weekend',
      startDate: '2026-11-09',
      endDate: '2026-11-11',
      currency: 'INR',
      totalBudgetMinor: 1_500_000,
    });
    const stop = await stopsRepo.createStop({
      tripId: trip.id,
      name: 'Red Fort',
      address: 'Netaji Subhash Marg',
      googlePlaceId: null,
      lat: 28.65,
      lng: 77.24,
      rating: 4.5,
      photoRef: null,
      plannedBudgetMinor: 200_000,
      notes: 'Best at sunset',
    });
    await stopsRepo.updateStop(stop.id, { dayDate: '2026-11-09', startTime: '10:00' });
    await activitiesRepo.createActivity({
      stopId: stop.id,
      title: 'Light show',
      estimatedCostMinor: 50_000,
      done: true,
      startTime: '19:00',
      durationMin: 45,
    });
    await foodRepo.createFoodPlan({
      stopId: stop.id,
      googlePlaceId: null,
      name: "Karim's",
      cuisine: 'Mughlai',
      estimatedCostMinor: 80_000,
      notes: null,
    });
    await expensesRepo.createExpense({
      tripId: trip.id,
      stopId: stop.id,
      category: 'food',
      amountMinor: 75_000,
      note: 'Lunch',
      spentAt: '2026-11-09',
    });
    await bookingsRepo.createBooking({
      tripId: trip.id,
      kind: 'flight',
      title: 'DEL to BOM',
      confirmation: 'PNR7Y2Q',
      startsAt: '2026-11-09T06:00',
      endsAt: null,
      location: null,
      costMinor: null,
      notes: null,
      attachmentUri: null,
      attachmentName: null,
    });
    await packingRepo.createPackingItem({
      tripId: trip.id,
      title: 'Sunscreen',
      category: 'Health',
    });
    await journalRepo.setNote(trip.id, '2026-11-09', 'Rained all afternoon');
    await journalRepo.addPhotos(trip.id, '2026-11-09', ['file:///old-phone/a.jpg']);
    return trip;
  }

  it('carries every table out and back in unchanged', async () => {
    await seed();
    const before = await buildBackup(new Date('2026-08-29T00:00:00Z'));

    expect(before.exportedAt).toBe('2026-08-29T00:00:00.000Z');
    expect(before.trips).toHaveLength(1);
    expect(before.stops[0].dayDate).toBe('2026-11-09');
    expect(before.activities[0].done).toBe(true);
    expect(before.activities[0].durationMin).toBe(45);
    expect(before.bookings[0].confirmation).toBe('PNR7Y2Q');
    expect(before.packing[0].title).toBe('Sunscreen');
    expect(before.journal[0].note).toBe('Rained all afternoon');

    // A fresh database, as a new phone would be.
    setDbForTesting(await openTestDb());
    expect(await tripsRepo.listTrips()).toHaveLength(0);

    const counts = await restoreBackup(before);
    expect(counts).toEqual({
      trips: 1, stops: 1, activities: 1, foodPlans: 1, expenses: 1, bookings: 1,
      packing: 1, journal: 1,
    });

    const after = await buildBackup(new Date('2026-08-29T00:00:00Z'));
    expect(after).toEqual(before);
  });

  it('replaces what is there rather than merging two copies of a trip', async () => {
    await seed();
    const backup = await buildBackup();

    await tripsRepo.createTrip({
      name: 'Somewhere else',
      startDate: null,
      endDate: null,
      currency: 'INR',
      totalBudgetMinor: null,
    });
    expect(await tripsRepo.listTrips()).toHaveLength(2);

    await restoreBackup(backup);
    const trips = await tripsRepo.listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].name).toBe('Delhi long weekend');
  });

  it('carries the words of a journal but not its photos', async () => {
    // The file paths point into the old phone's storage; restoring them would
    // produce a gallery of grey boxes.
    await seed();
    const backup = await buildBackup();
    expect(backup.journal[0].note).toBe('Rained all afternoon');
    expect(backup.journal[0].photos).toEqual([]);
  });

  it('drops attachment paths, which point at a phone you no longer have', async () => {
    const trip = await seed();
    await bookingsRepo.createBooking({
      tripId: trip.id,
      kind: 'train',
      title: 'Shatabdi',
      confirmation: null,
      startsAt: null,
      endsAt: null,
      location: null,
      costMinor: null,
      notes: null,
      attachmentUri: 'file:///data/user/0/app/documents/attachments/1-ticket.pdf',
      attachmentName: 'ticket.pdf',
    });

    const backup = await buildBackup();
    const withTicket = backup.bookings.find((b) => b.title === 'Shatabdi')!;
    expect(withTicket.attachmentUri).toBeNull();
    expect(withTicket.attachmentName).toBeNull();
    // The booking itself survives; only the copy of the file is gone.
    expect(withTicket.title).toBe('Shatabdi');
  });

  it('leaves the database alone when a restore fails part way', async () => {
    await seed();
    const backup = await buildBackup();

    // A stop pointing at a trip that isn't in the file: the foreign key fires
    // mid-insert, and the whole restore has to roll back.
    const broken = {
      ...backup,
      stops: [...backup.stops, { ...backup.stops[0], id: 'orphan', tripId: 'no-such-trip' }],
    };

    await expect(restoreBackup(broken)).rejects.toBeDefined();
    expect(await tripsRepo.listTrips()).toHaveLength(1);
    expect(await stopsRepo.listStops(backup.trips[0].id)).toHaveLength(1);
  });
});

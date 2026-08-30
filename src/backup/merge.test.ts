import { getDb, openTestDb, setDbForTesting } from '../db/client';
import * as bookingsRepo from '../db/repositories/bookings';
import * as expensesRepo from '../db/repositories/expenses';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import { resetForTesting } from '../sync/clock';
import { buildBackup, mergeBackup, restoreBackup } from './backup';
import type { Backup } from './format';

/**
 * Two devices, one file passed between them. This is the closest thing to real
 * sync the app has, so it is tested as the sequence a person would actually
 * perform rather than as a set of units.
 */
describe('merging a backup instead of replacing', () => {
  /** Starts a fresh device with its own database and its own clock identity. */
  async function newDevice(): Promise<void> {
    setDbForTesting(await openTestDb());
    resetForTesting();
  }

  const newTrip = (name: string) =>
    tripsRepo.createTrip({
      name, startDate: '2026-11-09', endDate: '2026-11-11',
      currency: 'INR', totalBudgetMinor: null,
    });

  const newStop = (tripId: string, name: string) =>
    stopsRepo.createStop({
      tripId, name, address: null, googlePlaceId: null, lat: null, lng: null,
      rating: null, photoRef: null, plannedBudgetMinor: null, notes: null,
    });

  afterEach(() => {
    setDbForTesting(null);
    resetForTesting();
  });

  it('keeps what each device had that the other did not', async () => {
    await newDevice();
    const phone = await newTrip('Delhi');
    await newStop(phone.id, 'Red Fort');
    const fromPhone = await buildBackup();

    await newDevice();
    const tablet = await newTrip('Goa');
    await newStop(tablet.id, 'Palolem');

    await mergeBackup(fromPhone);

    const names = (await tripsRepo.listTrips()).map((t) => t.name).sort();
    expect(names).toEqual(['Delhi', 'Goa']);
  });

  it('does not duplicate what both devices already have', async () => {
    await newDevice();
    const trip = await newTrip('Delhi');
    await newStop(trip.id, 'Red Fort');
    const file = await buildBackup();

    // The same file merged back into the device it came from is a no-op.
    const stats = await mergeBackup(file);
    expect(stats.added).toBe(0);
    expect((await tripsRepo.listTrips())).toHaveLength(1);
    expect(await stopsRepo.listStops(trip.id)).toHaveLength(1);
  });

  it('takes the newer edit when both devices changed the same thing', async () => {
    await newDevice();
    const trip = await newTrip('Delhi');
    const early = await buildBackup();

    // The tablet edits it, and its edit is the later one.
    await newDevice();
    await restoreBackup(early);
    await tripsRepo.updateTrip(trip.id, { name: 'Delhi, edited on the tablet' });
    const fromTablet = await buildBackup();

    // The phone edited it first.
    await newDevice();
    await restoreBackup(early);
    await mergeBackup(fromTablet);

    expect((await tripsRepo.listTrips())[0].name).toBe('Delhi, edited on the tablet');
  });

  it('does not hand back something the other device deleted', async () => {
    // The behaviour restore-as-replace could never get right, and the one that
    // makes people stop trusting sync.
    await newDevice();
    const trip = await newTrip('Delhi');
    const booking = await bookingsRepo.createBooking({
      tripId: trip.id, kind: 'flight', title: 'DEL to BOM', confirmation: null,
      startsAt: null, endsAt: null, location: null, costMinor: null, notes: null,
      attachmentUri: null, attachmentName: null,
    });
    const before = await buildBackup();

    // The tablet deletes the booking.
    await newDevice();
    await restoreBackup(before);
    await bookingsRepo.deleteBooking(booking.id);
    const fromTablet = await buildBackup();

    // The phone still has it, and merging must not resurrect it.
    await newDevice();
    await restoreBackup(before);
    await mergeBackup(fromTablet);

    expect(await bookingsRepo.listBookings(trip.id)).toHaveLength(0);
  });

  it('keeps a row the other device deleted before this one edited it', async () => {
    await newDevice();
    const trip = await newTrip('Delhi');
    const booking = await bookingsRepo.createBooking({
      tripId: trip.id, kind: 'flight', title: 'DEL to BOM', confirmation: null,
      startsAt: null, endsAt: null, location: null, costMinor: null, notes: null,
      attachmentUri: null, attachmentName: null,
    });
    const before = await buildBackup();

    await newDevice();
    await restoreBackup(before);
    await bookingsRepo.deleteBooking(booking.id);
    const fromTablet = await buildBackup();

    await newDevice();
    await restoreBackup(before);
    // The edit happens after the delete did, so it is the later intention.
    await bookingsRepo.updateBooking(booking.id, { title: 'DEL to GOI' });
    await mergeBackup(fromTablet);

    const kept = await bookingsRepo.listBookings(trip.id);
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toBe('DEL to GOI');
  });

  it('converges however many times the file goes back and forth', async () => {
    await newDevice();
    const trip = await newTrip('Delhi');
    await newStop(trip.id, 'Red Fort');
    const round1 = await buildBackup();

    await newDevice();
    await restoreBackup(round1);
    await newStop(trip.id, 'India Gate');
    await expensesRepo.createExpense({
      tripId: trip.id, stopId: null, category: 'transport', amountMinor: 5_000,
      note: 'Taxi', spentAt: '2026-11-09',
    });
    const round2 = await buildBackup();

    await newDevice();
    await restoreBackup(round1);
    await mergeBackup(round2);
    const round3 = await buildBackup();

    // Both sides now hold the same set, and another merge changes nothing.
    const stats = await mergeBackup(round2);
    expect(stats.added).toBe(0);
    expect(stats.incoming).toBe(0);

    expect((await stopsRepo.listStops(trip.id)).map((s) => s.name).sort()).toEqual([
      'India Gate', 'Red Fort',
    ]);
    expect(await expensesRepo.listExpenses(trip.id)).toHaveLength(1);
    expect(round3.stops).toHaveLength(2);
  });

  it('restores a version 1 file, which has no stamps at all', async () => {
    // Files written before stamps existed have to keep working; their rows
    // simply have nothing to win a comparison with.
    await newDevice();
    const legacy = {
      kind: 'waypoint.backup',
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      trips: [
        {
          id: 'old-1', name: 'From an old build', startDate: null, endDate: null,
          currency: 'INR', homeCurrency: null, ratePpm: null, totalBudgetMinor: null,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      stops: [], activities: [], foodPlans: [], expenses: [], bookings: [],
      packing: [], journal: [], tombstones: [],
    } as unknown as Backup;

    await mergeBackup(legacy);
    expect((await tripsRepo.listTrips())[0].name).toBe('From an old build');
  });

  it('leaves every merged row with a stamp it can be merged on again', async () => {
    await newDevice();
    const trip = await newTrip('Delhi');
    await newStop(trip.id, 'Red Fort');
    const file = await buildBackup();

    await newDevice();
    await mergeBackup(file);

    const rows = await (await getDb()).getAllAsync<{ updated_at: string }>(
      `SELECT updated_at FROM stops`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].updated_at).not.toBe('');
  });
});

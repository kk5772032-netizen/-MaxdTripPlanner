import { openTestDb, setDbForTesting } from '../client';
import * as bookingsRepo from './bookings';
import * as expensesRepo from './expenses';
import * as tripsRepo from './trips';
import { bookingExpenseCategory } from '../../tokens';

/**
 * A booking's cost becoming an expense. The link matters more than the amount:
 * without it nothing can tell whether a flight has already been paid for, and
 * a trip quietly double-counts it.
 */
describe('expenses logged from a booking', () => {
  let tripId: string;

  beforeEach(async () => {
    setDbForTesting(await openTestDb());
    const trip = await tripsRepo.createTrip({
      name: 'Delhi', startDate: null, endDate: null, currency: 'INR', totalBudgetMinor: null,
    });
    tripId = trip.id;
  });

  afterEach(() => setDbForTesting(null));

  const newBooking = (over: Partial<bookingsRepo.NewBooking> = {}) =>
    bookingsRepo.createBooking({
      tripId, kind: 'flight', title: 'DEL to BOM', confirmation: null, startsAt: null,
      endsAt: null, location: null, costMinor: null, notes: null, attachmentUri: null,
      attachmentName: null, ...over,
    });

  it('remembers which booking an expense came from', async () => {
    const booking = await newBooking({ costMinor: 850_000 });
    await expensesRepo.createExpense({
      tripId, stopId: null, category: 'transport', amountMinor: 850_000,
      note: booking.title, spentAt: '2026-11-09', bookingId: booking.id,
    });

    const [expense] = await expensesRepo.listExpenses(tripId);
    expect(expense.bookingId).toBe(booking.id);
    expect(expense.amountMinor).toBe(850_000);
  });

  it('leaves a hand-typed expense unlinked', async () => {
    await expensesRepo.createExpense({
      tripId, stopId: null, category: 'food', amountMinor: 40_000,
      note: 'Chai', spentAt: '2026-11-09',
    });
    const [expense] = await expensesRepo.listExpenses(tripId);
    expect(expense.bookingId).toBeNull();
  });

  it('keeps the expense when the booking is deleted', async () => {
    // You still spent the money. The link goes, the spend stays.
    const booking = await newBooking({ costMinor: 850_000 });
    await expensesRepo.createExpense({
      tripId, stopId: null, category: 'transport', amountMinor: 850_000,
      note: booking.title, spentAt: '2026-11-09', bookingId: booking.id,
    });

    await bookingsRepo.deleteBooking(booking.id);

    const [expense] = await expensesRepo.listExpenses(tripId);
    expect(expense).toBeDefined();
    expect(expense.amountMinor).toBe(850_000);
    expect(expense.bookingId).toBeNull();
  });

  it('files every kind of booking under a category that makes sense', () => {
    // Every way of getting somewhere is transport, whatever the vehicle.
    expect(bookingExpenseCategory.flight).toBe('transport');
    expect(bookingExpenseCategory.train).toBe('transport');
    expect(bookingExpenseCategory.bus).toBe('transport');
    expect(bookingExpenseCategory.car).toBe('transport');
    expect(bookingExpenseCategory.lodging).toBe('lodging');
    expect(bookingExpenseCategory.restaurant).toBe('food');
    expect(bookingExpenseCategory.other).toBe('other');
  });
});

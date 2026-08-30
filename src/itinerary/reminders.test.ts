import { MAX_REMINDERS, remindersFor, remindersForTrip } from './reminders';
import type { Booking } from '../types';

const booking = (o: Partial<Booking> = {}): Booking => ({
  id: 'b1', tripId: 't', kind: 'flight', title: 'DEL to BOM, AI 665',
  confirmation: null, startsAt: null, endsAt: null, location: null, costMinor: null,
  notes: null, attachmentUri: null, attachmentName: null,
  createdAt: '2026-08-01T00:00:00.000Z', ...o,
});

/** Local time throughout — a reminder is about the clock on the wall. */
const local = (s: string) => new Date(s);

describe('remindersFor', () => {
  const now = local('2026-11-08T10:00:00');

  it('says something the night before and again on the day', () => {
    const r = remindersFor(
      booking({ startsAt: '2026-11-09T06:00', confirmation: 'PNR7Y2Q', location: 'Terminal 3' }),
      now,
    );
    expect(r).toHaveLength(2);

    expect(r[0].title).toBe('Flight tomorrow at 6:00 am');
    expect(r[0].body).toBe('DEL to BOM, AI 665 · PNR7Y2Q');
    expect(r[0].at).toEqual(local('2026-11-08T21:00:00'));

    // Three hours before a flight is when you should be leaving.
    expect(r[1].title).toBe('Flight in 3 hours');
    expect(r[1].body).toContain('Terminal 3');
    expect(r[1].at).toEqual(local('2026-11-09T03:00:00'));
  });

  it('gives a table an hour, not three', () => {
    // A restaurant is round the corner; a three-hour warning is noise you
    // learn to swipe away, which costs you the ones that matter.
    const r = remindersFor(
      booking({ kind: 'restaurant', title: 'Indian Accent', startsAt: '2026-11-09T20:00' }),
      now,
    );
    expect(r[1].title).toBe('Table in 1 hour');
    expect(r[1].at).toEqual(local('2026-11-09T19:00:00'));
  });

  it('says nothing about a booking with only a date', () => {
    // "Your flight is at some point tomorrow" helps nobody, and inventing a
    // time to remind about would be worse.
    expect(remindersFor(booking({ startsAt: '2026-11-09' }), now)).toEqual([]);
    expect(remindersFor(booking(), now)).toEqual([]);
  });

  it('skips an evening reminder that would already have passed', () => {
    // Booked at 11pm for 9am: there is no night before left to use.
    const late = local('2026-11-08T23:00:00');
    const r = remindersFor(booking({ startsAt: '2026-11-09T09:00' }), late);
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe('Flight in 3 hours');
  });

  it('says nothing at all about something already past', () => {
    expect(remindersFor(booking({ startsAt: '2026-11-01T06:00' }), now)).toEqual([]);
  });

  it('leaves out a reference it does not have', () => {
    const r = remindersFor(booking({ startsAt: '2026-11-09T06:00' }), now);
    expect(r[0].body).toBe('DEL to BOM, AI 665');
  });

  it('keeps ids stable, so rescheduling replaces rather than duplicates', () => {
    const b = booking({ id: 'abc', startsAt: '2026-11-09T06:00' });
    expect(remindersFor(b, now).map((r) => r.id)).toEqual([
      'booking-eve:abc',
      'booking-lead:abc',
    ]);
  });
});

describe('remindersForTrip', () => {
  const now = local('2026-11-08T10:00:00');

  it('orders them by when they fire', () => {
    const r = remindersForTrip(
      [
        booking({ id: 'late', title: 'Dinner', kind: 'restaurant', startsAt: '2026-11-10T20:00' }),
        booking({ id: 'early', startsAt: '2026-11-09T06:00' }),
      ],
      now,
    );
    expect(r[0].id).toBe('booking-eve:early');
    for (let i = 1; i < r.length; i++) {
      expect(r[i].at.getTime()).toBeGreaterThanOrEqual(r[i - 1].at.getTime());
    }
  });

  it('caps what it schedules', () => {
    // A phone holds a finite number of pending notifications; a fortnight with
    // everything booked should not spend that on days nobody has reached.
    const many = Array.from({ length: 40 }, (_, i) =>
      booking({ id: `b${i}`, startsAt: `2026-11-${String((i % 20) + 9).padStart(2, '0')}T09:00` }),
    );
    expect(remindersForTrip(many, now)).toHaveLength(MAX_REMINDERS);
  });
});

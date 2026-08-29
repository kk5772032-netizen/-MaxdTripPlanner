import {
  addMinutes,
  compareWithinDay,
  dayEntries,
  formatDayLabel,
  formatDuration,
  formatSpan,
  formatTime,
  moveBy,
  planByDay,
  reorderWithin,
  tripDays,
  tripLengthInDays,
} from './schedule';
import type { Booking, BookingKind, Stop, Trip } from '../types';

const trip = (startDate: string | null, endDate: string | null): Pick<Trip, 'startDate' | 'endDate'> =>
  ({ startDate, endDate });

let seq = 0;
function stop(overrides: Partial<Stop> = {}): Stop {
  return {
    id: `stop-${seq}`,
    tripId: 'trip-1',
    googlePlaceId: null,
    name: `Stop ${seq}`,
    address: null,
    lat: null,
    lng: null,
    rating: null,
    photoRef: null,
    sequence: seq++,
    dayDate: null,
    startTime: null,
    endTime: null,
    plannedBudgetMinor: null,
    notes: null,
    ...overrides,
  };
}

let bseq = 0;
function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: `booking-${bseq}`,
    tripId: 'trip-1',
    kind: 'flight' as BookingKind,
    title: `Booking ${bseq++}`,
    confirmation: null,
    startsAt: null,
    endsAt: null,
    location: null,
    costMinor: null,
    notes: null,
    attachmentUri: null,
    attachmentName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  seq = 0;
  bseq = 0;
});

describe('tripDays', () => {
  it('covers both ends of the range', () => {
    expect(tripDays(trip('2026-11-06', '2026-11-09'))).toEqual([
      '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09',
    ]);
  });

  it('treats a start with no end as a single day', () => {
    expect(tripDays(trip('2026-11-06', null))).toEqual(['2026-11-06']);
  });

  it('is empty when the trip has no dates — a normal state, not an error', () => {
    expect(tripDays(trip(null, null))).toEqual([]);
    expect(tripLengthInDays(trip(null, null))).toBeNull();
  });

  it('crosses a month boundary', () => {
    expect(tripDays(trip('2026-10-30', '2026-11-02'))).toEqual([
      '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02',
    ]);
  });

  it('crosses a leap day', () => {
    expect(tripDays(trip('2028-02-28', '2028-03-01'))).toEqual([
      '2028-02-28', '2028-02-29', '2028-03-01',
    ]);
  });

  it('does not shift the day for timezones west of UTC', () => {
    // The bug this guards: new Date('2026-11-06') is midnight UTC, which is
    // still 5 November in New York, so a naive local read loses a day.
    expect(tripDays(trip('2026-11-06', '2026-11-06'))).toEqual(['2026-11-06']);
    expect(formatDayLabel('2026-11-06')).toBe('Fri 6 Nov');
  });

  it('survives an end date before the start rather than looping forever', () => {
    expect(tripDays(trip('2026-11-09', '2026-11-06'))).toEqual(['2026-11-09']);
  });
});

describe('planByDay', () => {
  it('lists every trip day, including the empty ones', () => {
    const plan = planByDay(trip('2026-11-06', '2026-11-08'), [
      stop({ dayDate: '2026-11-07', name: 'India Gate' }),
    ]);
    expect(plan.map((d) => d.date)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    // An empty day is information: it is where "add something" belongs.
    expect(plan[0].stops).toEqual([]);
    expect(plan[1].stops.map((s) => s.name)).toEqual(['India Gate']);
  });

  it('numbers the days from one', () => {
    const plan = planByDay(trip('2026-11-06', '2026-11-08'), []);
    expect(plan.map((d) => d.dayNumber)).toEqual([1, 2, 3]);
  });

  it('puts undated stops in their own bucket at the end', () => {
    const plan = planByDay(trip('2026-11-06', '2026-11-06'), [
      stop({ name: 'Someday: Lodhi Garden' }),
      stop({ dayDate: '2026-11-06', name: 'India Gate' }),
    ]);
    const last = plan[plan.length - 1];
    expect(last.date).toBeNull();
    expect(last.dayNumber).toBeNull();
    expect(last.stops.map((s) => s.name)).toEqual(['Someday: Lodhi Garden']);
  });

  it('orders a day by time, with untimed stops after the timed ones', () => {
    const plan = planByDay(trip('2026-11-06', '2026-11-06'), [
      stop({ dayDate: '2026-11-06', name: 'Evening', startTime: '18:00' }),
      stop({ dayDate: '2026-11-06', name: 'Whenever' }),
      stop({ dayDate: '2026-11-06', name: 'Morning', startTime: '09:30' }),
    ]);
    expect(plan[0].stops.map((s) => s.name)).toEqual(['Morning', 'Evening', 'Whenever']);
  });

  it('keeps a stop dated outside the trip rather than hiding it', () => {
    const plan = planByDay(trip('2026-11-06', '2026-11-07'), [
      stop({ dayDate: '2026-12-25', name: 'Wrong date' }),
    ]);
    const stray = plan.find((d) => d.date === '2026-12-25');
    // Silently dropping someone's data is worse than showing an odd date.
    expect(stray?.stops.map((s) => s.name)).toEqual(['Wrong date']);
    expect(stray?.dayNumber).toBeNull();
  });

  it('shows only the unscheduled bucket when the trip has no dates', () => {
    const plan = planByDay(trip(null, null), [stop({ name: 'India Gate' })]);
    expect(plan).toHaveLength(1);
    expect(plan[0].date).toBeNull();
    expect(plan[0].stops.map((s) => s.name)).toEqual(['India Gate']);
  });

  it('breaks ties at the same time by sequence', () => {
    const a = stop({ dayDate: '2026-11-06', name: 'First', startTime: '09:00' });
    const b = stop({ dayDate: '2026-11-06', name: 'Second', startTime: '09:00' });
    expect(compareWithinDay(a, b)).toBeLessThan(0);
  });
});

describe('formatting', () => {
  it('formats times as 12-hour with a meridiem', () => {
    expect(formatTime('09:30')).toBe('9:30 am');
    expect(formatTime('13:05')).toBe('1:05 pm');
    expect(formatTime('00:15')).toBe('12:15 am');
    expect(formatTime('12:00')).toBe('12:00 pm');
    expect(formatTime(null)).toBeNull();
  });

  it('formats a span, and falls back to the start alone', () => {
    expect(formatSpan({ startTime: '09:30', endTime: '11:00' })).toBe('9:30 am – 11:00 am');
    expect(formatSpan({ startTime: '09:30', endTime: null })).toBe('9:30 am');
    expect(formatSpan({ startTime: null, endTime: null })).toBeNull();
  });

  it('adds minutes without rolling past midnight', () => {
    expect(addMinutes('09:30', 90)).toBe('11:00');
    expect(addMinutes('23:30', 90)).toBe('23:59');
  });

  it('formats durations the way people say them', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(270)).toBe('4h 30m');
    expect(formatDuration(0)).toBeNull();
  });
});


describe('bookings on the plan', () => {
  const nov = trip('2026-11-09', '2026-11-11');

  it('puts a booking on the day it starts', () => {
    const flight = booking({ startsAt: '2026-11-09T06:00' });
    const days = planByDay(nov, [], [flight]);
    expect(days[0].bookings).toEqual([
      { booking: flight, time: '06:00', role: 'start' },
    ]);
    expect(days[1].bookings).toEqual([]);
  });

  it('leaves an undated booking off the plan entirely', () => {
    // It still exists under Booked. Guessing a day would put a fiction on the
    // itinerary, which is worse than the booking not being there.
    const days = planByDay(nov, [], [booking()]);
    expect(days.every((d) => d.bookings.length === 0)).toBe(true);
  });

  it('carries a day-only booking without inventing a time', () => {
    const days = planByDay(nov, [], [booking({ startsAt: '2026-11-10' })]);
    expect(days[1].bookings[0].time).toBeNull();
  });

  it('shows a hotel again on the morning you have to be out', () => {
    const hotel = booking({
      kind: 'lodging',
      startsAt: '2026-11-09T15:00',
      endsAt: '2026-11-11T11:00',
    });
    const days = planByDay(nov, [], [hotel]);
    expect(days[0].bookings[0].role).toBe('start');
    expect(days[1].bookings).toEqual([]);
    expect(days[2].bookings).toEqual([{ booking: hotel, time: '11:00', role: 'checkout' }]);
  });

  it('does not double up a hotel booked for a single day', () => {
    const hotel = booking({
      kind: 'lodging',
      startsAt: '2026-11-09T15:00',
      endsAt: '2026-11-09T23:00',
    });
    expect(planByDay(nov, [], [hotel])[0].bookings).toHaveLength(1);
  });

  it('only splits lodging — a flight has one moment, not two', () => {
    const flight = booking({ startsAt: '2026-11-09T06:00', endsAt: '2026-11-10T09:00' });
    const days = planByDay(nov, [], [flight]);
    expect(days[0].bookings).toHaveLength(1);
    expect(days[1].bookings).toHaveLength(0);
  });

  it('keeps the flight home the morning after the trip ends', () => {
    const days = planByDay(nov, [], [booking({ startsAt: '2026-11-12T06:00' })]);
    const last = days[days.length - 1];
    expect(last.date).toBe('2026-11-12');
    expect(last.dayNumber).toBeNull();
    expect(last.bookings).toHaveLength(1);
  });

  it('puts a booking the day before the trip before day one', () => {
    const days = planByDay(nov, [], [booking({ startsAt: '2026-11-08T22:00' })]);
    expect(days[0].date).toBe('2026-11-08');
    expect(days[1].dayNumber).toBe(1);
  });
});

describe('dayEntries', () => {
  const nov = trip('2026-11-09', '2026-11-11');

  it('reads a day as one column on the clock', () => {
    const flight = booking({ startsAt: '2026-11-09T06:00', title: 'DEL to BOM' });
    const museum = stop({ dayDate: '2026-11-09', startTime: '10:00', name: 'Museum' });
    const dinner = booking({
      kind: 'restaurant',
      startsAt: '2026-11-09T20:00',
      title: 'Table for 4',
    });

    const entries = dayEntries(planByDay(nov, [museum], [flight, dinner])[0]);
    expect(entries.map((e) => (e.kind === 'stop' ? e.stop.name : e.booking.title))).toEqual([
      'DEL to BOM',
      'Museum',
      'Table for 4',
    ]);
  });

  it('sends untimed rows to the bottom, stops before bookings', () => {
    const timed = stop({ dayDate: '2026-11-09', startTime: '09:00', name: 'Timed' });
    const untimed = stop({ dayDate: '2026-11-09', name: 'Untimed' });
    const hotel = booking({ kind: 'lodging', startsAt: '2026-11-09', title: 'Hotel' });

    const entries = dayEntries(planByDay(nov, [timed, untimed], [hotel])[0]);
    expect(entries.map((e) => (e.kind === 'stop' ? e.stop.name : e.booking.title))).toEqual([
      'Timed',
      'Untimed',
      'Hotel',
    ]);
  });

  it('puts the booking first when it clashes with a stop', () => {
    // You have to be at the airport before you can be anywhere else.
    const flight = booking({ startsAt: '2026-11-09T09:00', title: 'Flight' });
    const place = stop({ dayDate: '2026-11-09', startTime: '09:00', name: 'Place' });
    const entries = dayEntries(planByDay(nov, [place], [flight])[0]);
    expect(entries[0].kind).toBe('booking');
  });
});

describe('reordering inside a day', () => {
  it('puts the moved stops back in the slots they came from', () => {
    // Trip-wide order is a,b,c,d,e. Tuesday holds b and d; swapping them must
    // not move c, which belongs to another day and sits between them.
    expect(reorderWithin(['a', 'b', 'c', 'd', 'e'], ['d', 'b'])).toEqual([
      'a', 'd', 'c', 'b', 'e',
    ]);
  });

  it('leaves everything alone when the subset does not fit', () => {
    const all = ['a', 'b', 'c'];
    expect(reorderWithin(all, ['b', 'z'])).toEqual(all);
  });

  it('is a no-op for a subset of one', () => {
    expect(reorderWithin(['a', 'b', 'c'], ['b'])).toEqual(['a', 'b', 'c']);
  });

  it('moves an item one place at a time', () => {
    expect(moveBy(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveBy(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('stops at the ends rather than wrapping around', () => {
    const items = ['a', 'b', 'c'];
    expect(moveBy(items, 0, -1)).toBe(items);
    expect(moveBy(items, 2, 1)).toBe(items);
    expect(moveBy(items, 9, 1)).toBe(items);
  });
});

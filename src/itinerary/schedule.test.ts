import {
  addMinutes,
  compareWithinDay,
  formatDayLabel,
  formatDuration,
  formatSpan,
  formatTime,
  planByDay,
  tripDays,
  tripLengthInDays,
} from './schedule';
import type { Stop, Trip } from '../types';

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

beforeEach(() => {
  seq = 0;
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

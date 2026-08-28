import { openState, priceLevelLabel, todayHours, type OpeningHours } from './hours';

/** Monday–Friday 09:00–17:00, in a zone five and a half hours ahead of UTC. */
const weekday: OpeningHours = {
  periods: [1, 2, 3, 4, 5].map((day) => ({
    open: { day, hour: 9, minute: 0 },
    close: { day, hour: 17, minute: 0 },
  })),
  weekdayDescriptions: [
    'Monday: 9:00 AM – 5:00 PM',
    'Tuesday: 9:00 AM – 5:00 PM',
    'Wednesday: 9:00 AM – 5:00 PM',
    'Thursday: 9:00 AM – 5:00 PM',
    'Friday: 9:00 AM – 5:00 PM',
    'Saturday: Closed',
    'Sunday: Closed',
  ],
  utcOffsetMinutes: 330,
};

/** Friday 22:00 through Saturday 02:00 — the case that wraps midnight. */
const lateBar: OpeningHours = {
  periods: [{ open: { day: 5, hour: 22, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }],
  weekdayDescriptions: [],
  utcOffsetMinutes: 330,
};

/** 2026-11-09 is a Monday. Times below are UTC; the place is at UTC+5:30. */
const utc = (iso: string) => new Date(`${iso}Z`);

describe('openState', () => {
  it('has no opinion without hours', () => {
    expect(openState(null)).toEqual({ status: 'unknown' });
    expect(openState({ ...weekday, periods: [] })).toEqual({ status: 'unknown' });
  });

  it('reads the clock in the place, not on the phone', () => {
    // 06:00 UTC on Monday is 11:30 in the place: open. Reading it as UTC would
    // land before nine and call it shut.
    expect(openState(weekday, utc('2026-11-09T06:00'))).toEqual({
      status: 'open',
      until: '17:00',
    });
  });

  it('closes when the place closes', () => {
    // 12:00 UTC Monday is 17:30 local — half an hour past closing.
    expect(openState(weekday, utc('2026-11-09T12:00'))).toEqual({
      status: 'closed',
      opensAt: '09:00',
    });
  });

  it('treats a period running past midnight as one stretch', () => {
    // Saturday 00:30 local, inside Friday's 22:00–02:00 period.
    expect(openState(lateBar, utc('2026-11-13T19:00'))).toEqual({
      status: 'open',
      until: '02:00',
    });
    // Saturday 03:00 local, an hour after last orders.
    expect(openState(lateBar, utc('2026-11-13T21:30'))).toEqual({
      status: 'closed',
      opensAt: '22:00',
    });
  });

  it('reports a place with no closing time as always open', () => {
    const always: OpeningHours = {
      periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
      weekdayDescriptions: [],
      utcOffsetMinutes: 0,
    };
    expect(openState(always, utc('2026-11-09T03:00'))).toEqual({ status: 'open', until: null });
  });

  it('finds the next opening across the weekend', () => {
    // Saturday afternoon local: the next Monday morning is what to show.
    expect(openState(weekday, utc('2026-11-14T08:00'))).toEqual({
      status: 'closed',
      opensAt: '09:00',
    });
  });
});

describe('todayHours', () => {
  it('takes the Monday-first line for the place local day', () => {
    // 20:00 UTC Sunday is 01:30 Monday in the place — Monday's line, not Sunday's.
    expect(todayHours(weekday, utc('2026-11-08T20:00'))).toBe('9:00 AM – 5:00 PM');
    expect(todayHours(weekday, utc('2026-11-14T08:00'))).toBe('Closed');
  });

  it('returns nothing rather than a wrong day when the list is short', () => {
    expect(todayHours({ ...weekday, weekdayDescriptions: ['Monday: 9-5'] })).toBeNull();
    expect(todayHours(null)).toBeNull();
  });
});

describe('priceLevelLabel', () => {
  it('repeats the currency symbol', () => {
    expect(priceLevelLabel(2, '₹')).toBe('₹₹');
    expect(priceLevelLabel(4, '$')).toBe('$$$$');
  });

  it('says nothing for free, unknown or out-of-range levels', () => {
    expect(priceLevelLabel(0, '₹')).toBeNull();
    expect(priceLevelLabel(null, '₹')).toBeNull();
    expect(priceLevelLabel(9, '₹')).toBeNull();
  });
});

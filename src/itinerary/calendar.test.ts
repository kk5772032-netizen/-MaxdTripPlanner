import { planAsIcs } from './calendar';
import type { PlanData } from './exportPlan';
import type { Booking, Stop, Trip } from '../types';

const trip: Trip = {
  id: 't', name: 'Delhi long weekend', startDate: '2026-11-09', endDate: '2026-11-11',
  currency: 'INR', homeCurrency: null, ratePpm: null, totalBudgetMinor: null, createdAt: '2026-08-01T00:00:00.000Z',
};

const stop = (o: Partial<Stop> = {}): Stop => ({
  id: 's1', tripId: 't', googlePlaceId: null, name: 'Red Fort', address: null, lat: null,
  lng: null, rating: null, photoRef: null, sequence: 0, dayDate: null, startTime: null,
  endTime: null, plannedBudgetMinor: null, notes: null, ...o,
});

const booking = (o: Partial<Booking> = {}): Booking => ({
  id: 'b1', tripId: 't', kind: 'flight', title: 'DEL to BOM', confirmation: null,
  startsAt: null, endsAt: null, location: null, costMinor: null, notes: null,
  attachmentUri: null, attachmentName: null, createdAt: '2026-08-01T00:00:00.000Z', ...o,
});

const plan = (o: Partial<PlanData> = {}): PlanData => ({
  trip, stops: [], activities: [], foodPlans: [], bookings: [], ...o,
});

const at = new Date('2026-08-29T12:00:00Z');
const lines = (ics: string) => ics.split('\r\n');

describe('planAsIcs', () => {
  it('says nothing rather than producing an empty calendar', () => {
    // An empty file imports as silence, which looks exactly like a bug.
    expect(planAsIcs(plan(), at)).toBeNull();
    expect(planAsIcs(plan({ stops: [stop()] }), at)).toBeNull();
  });

  it('wraps events in a valid calendar', () => {
    const ics = planAsIcs(plan({ stops: [stop({ dayDate: '2026-11-09' })] }), at)!;
    const l = lines(ics);
    expect(l[0]).toBe('BEGIN:VCALENDAR');
    expect(l).toContain('VERSION:2.0');
    expect(l).toContain('X-WR-CALNAME:Delhi long weekend');
    expect(l[l.length - 2]).toBe('END:VCALENDAR');
    // CRLF throughout, with a trailing break, as the spec requires.
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.includes('\n\n')).toBe(false);
  });

  it('writes wall-clock times with no timezone, so 6am stays 6am', () => {
    const ics = planAsIcs(
      plan({ bookings: [booking({ startsAt: '2026-11-09T06:00' })] }),
      at,
    )!;
    expect(lines(ics)).toContain('DTSTART:20261109T060000');
    expect(ics).not.toContain('DTSTART:20261109T060000Z');
    expect(ics).not.toContain('TZID');
  });

  it('gives an untimed stop the whole day, ending the morning after', () => {
    const ics = planAsIcs(plan({ stops: [stop({ dayDate: '2026-11-09' })] }), at)!;
    const l = lines(ics);
    expect(l).toContain('DTSTART;VALUE=DATE:20261109');
    // An all-day DTEND is exclusive: the 10th means "through the 9th".
    expect(l).toContain('DTEND;VALUE=DATE:20261110');
  });

  it('gives an open-ended stop an hour rather than no width at all', () => {
    const ics = planAsIcs(
      plan({ stops: [stop({ dayDate: '2026-11-09', startTime: '10:00' })] }),
      at,
    )!;
    expect(lines(ics)).toContain('DTEND:20261109T110000');
  });

  it('uses a booking end time when it has one', () => {
    const ics = planAsIcs(
      plan({ bookings: [booking({ startsAt: '2026-11-09T06:00', endsAt: '2026-11-09T08:30' })] }),
      at,
    )!;
    expect(lines(ics)).toContain('DTEND:20261109T083000');
  });

  it('makes a hotel one entry across the stay, not two', () => {
    const ics = planAsIcs(
      plan({
        bookings: [
          booking({ kind: 'lodging', title: 'Hotel Broadway', startsAt: '2026-11-09T15:00', endsAt: '2026-11-11T11:00' }),
        ],
      }),
      at,
    )!;
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(lines(ics)).toContain('DTSTART:20261109T150000');
    expect(lines(ics)).toContain('DTEND:20261111T110000');
  });

  it('carries the reference number where you can find it', () => {
    const ics = planAsIcs(
      plan({ bookings: [booking({ startsAt: '2026-11-09T06:00', confirmation: 'PNR7Y2Q', location: 'Terminal 3' })] }),
      at,
    )!;
    expect(lines(ics)).toContain('DESCRIPTION:Confirmation: PNR7Y2Q');
    expect(lines(ics)).toContain('LOCATION:Terminal 3');
  });

  it('escapes the characters that would otherwise break the file', () => {
    const ics = planAsIcs(
      plan({ stops: [stop({ dayDate: '2026-11-09', name: 'Smith, Jones; Co', notes: 'line one\nline two' })] }),
      at,
    )!;
    expect(lines(ics)).toContain('SUMMARY:Smith\\, Jones\; Co');
    expect(lines(ics)).toContain('DESCRIPTION:line one\\nline two');
  });

  it('folds a long line so importers do not drop the event', () => {
    const ics = planAsIcs(
      plan({ stops: [stop({ dayDate: '2026-11-09', name: 'A'.repeat(200) })] }),
      at,
    )!;
    for (const line of lines(ics)) expect(line.length).toBeLessThanOrEqual(75);
    // Continuations are marked by a leading space, and rejoin to the original.
    expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${'A'.repeat(200)}`);
  });

  it('leaves stops with no day out of the calendar', () => {
    const ics = planAsIcs(
      plan({ stops: [stop({ dayDate: '2026-11-09' }), stop({ id: 's2', name: 'Someday' })] }),
      at,
    )!;
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).not.toContain('Someday');
  });
});

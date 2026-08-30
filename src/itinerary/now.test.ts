import {
  countdown,
  currentTrip,
  daysBetween,
  gettingReady,
  planForNow,
  tripPhase,
} from './now';
import type { Booking, Stop, Trip } from '../types';

let n = 0;
const trip = (o: Partial<Trip> = {}): Trip => ({
  id: `trip-${n++}`, name: 'Delhi', startDate: '2026-11-09', endDate: '2026-11-11',
  currency: 'INR', homeCurrency: null, ratePpm: null, totalBudgetMinor: null,
  createdAt: '2026-08-01T00:00:00.000Z', ...o,
});

let s = 0;
const stop = (o: Partial<Stop> = {}): Stop => ({
  id: `stop-${s}`, tripId: 'trip-0', googlePlaceId: null, name: `Stop ${s}`, address: null,
  lat: null, lng: null, rating: null, photoRef: null, sequence: s++, dayDate: null,
  startTime: null, endTime: null, plannedBudgetMinor: null, notes: null, ...o,
});

const booking = (o: Partial<Booking> = {}): Booking => ({
  id: 'b1', tripId: 'trip-0', kind: 'flight', title: 'DEL to BOM', confirmation: null,
  startsAt: null, endsAt: null, location: null, costMinor: null, notes: null,
  attachmentUri: null, attachmentName: null, createdAt: '2026-08-01T00:00:00.000Z', ...o,
});

const activity = (o = {}) => ({
  id: 'a1', stopId: 'stop-0', title: 'Light show', estimatedCostMinor: null, done: false,
  startTime: null, durationMin: null, notes: null, ...o,
});

beforeEach(() => {
  n = 0;
  s = 0;
});

describe('tripPhase', () => {
  it('knows which day of the trip today is', () => {
    expect(tripPhase(trip(), '2026-11-10')).toEqual({
      kind: 'running', date: '2026-11-10', dayNumber: 2, of: 3,
    });
  });

  it('counts down to one that has not started', () => {
    expect(tripPhase(trip(), '2026-11-02')).toEqual({ kind: 'upcoming', daysAway: 7 });
  });

  it('calls a finished trip finished', () => {
    expect(tripPhase(trip(), '2026-11-20')).toEqual({ kind: 'past' });
  });

  it('treats a trip with no dates as its own state, not as past', () => {
    // Naming a trip long before knowing when is normal, and calling that
    // "finished" would sort it to the bottom of everything.
    expect(tripPhase(trip({ startDate: null, endDate: null }), '2026-11-10')).toEqual({
      kind: 'undated',
    });
  });
});

describe('currentTrip', () => {
  it('opens on the one you are actually on', () => {
    const running = trip({ startDate: '2026-11-09', endDate: '2026-11-11' });
    const soon = trip({ startDate: '2026-12-01', endDate: '2026-12-05' });
    expect(currentTrip([soon, running], '2026-11-10')).toBe(running);
  });

  it('falls to the one starting soonest', () => {
    const near = trip({ startDate: '2026-11-20', endDate: '2026-11-25' });
    const far = trip({ startDate: '2027-02-01', endDate: '2027-02-05' });
    expect(currentTrip([far, near], '2026-11-10')).toBe(near);
  });

  it('prefers a dated trip to an undated one', () => {
    const someday = trip({ startDate: null, endDate: null });
    const planned = trip({ startDate: '2026-12-01', endDate: '2026-12-05' });
    expect(currentTrip([someday, planned], '2026-11-10')).toBe(planned);
  });

  it('falls back to the most recent finished trip', () => {
    const older = trip({ startDate: '2026-01-01', endDate: '2026-01-05' });
    const recent = trip({ startDate: '2026-10-01', endDate: '2026-10-05' });
    expect(currentTrip([older, recent], '2026-11-10')).toBe(recent);
  });

  it('has nothing to open when there is nothing', () => {
    expect(currentTrip([], '2026-11-10')).toBeNull();
  });
});

describe('planForNow', () => {
  const t = trip();

  it('says nothing at all when the trip is not running', () => {
    expect(planForNow(t, [], [], [], '2026-12-01', '09:00')).toBeNull();
  });

  it('picks the next timed thing still to come', () => {
    const flight = booking({ startsAt: '2026-11-09T06:00' });
    const museum = stop({ id: 'm', name: 'Museum', dayDate: '2026-11-09', startTime: '10:00' });
    const dinner = booking({ id: 'b2', kind: 'restaurant', title: 'Table', startsAt: '2026-11-09T20:00' });

    const plan = planForNow(t, [museum], [flight, dinner], [], '2026-11-09', '08:00')!;
    expect(plan.next?.kind === 'stop' && plan.next.stop.name).toBe('Museum');
    // The flight has already left.
    expect(plan.earlier).toHaveLength(1);
    expect(plan.later.map((e) => (e.kind === 'booking' ? e.booking.title : ''))).toEqual(['Table']);
  });

  it('counts a thing happening right now as next, not as past', () => {
    const museum = stop({ id: 'm', dayDate: '2026-11-09', startTime: '10:00' });
    const plan = planForNow(t, [museum], [], [], '2026-11-09', '10:00')!;
    expect(plan.next).not.toBeNull();
    expect(plan.earlier).toEqual([]);
  });

  it('never promotes an untimed stop to next', () => {
    // It has not claimed a moment; putting it at the top of the screen would be
    // the app inventing a schedule nobody set.
    const loose = stop({ id: 'l', dayDate: '2026-11-09' });
    const plan = planForNow(t, [loose], [], [], '2026-11-09', '09:00')!;
    expect(plan.next).toBeNull();
    expect(plan.later).toHaveLength(1);
  });

  it('runs out of next once the day has', () => {
    const museum = stop({ id: 'm', dayDate: '2026-11-09', startTime: '10:00' });
    const plan = planForNow(t, [museum], [], [], '2026-11-09', '23:00')!;
    expect(plan.next).toBeNull();
    expect(plan.earlier).toHaveLength(1);
  });

  it("gathers the unticked to-dos at today's stops only", () => {
    const today = stop({ id: 'stop-0', dayDate: '2026-11-09' });
    const tomorrow = stop({ id: 'stop-1', dayDate: '2026-11-10' });
    const plan = planForNow(
      t,
      [today, tomorrow],
      [],
      [
        activity({ id: 'a1', stopId: 'stop-0' }),
        activity({ id: 'a2', stopId: 'stop-0', done: true }),
        activity({ id: 'a3', stopId: 'stop-1' }),
      ],
      '2026-11-09',
      '09:00',
    )!;
    expect(plan.todo.map((a) => a.id)).toEqual(['a1']);
  });
});

describe('countdown', () => {
  it('reads the way people say it', () => {
    expect(countdown(0)).toBe('today');
    expect(countdown(1)).toBe('tomorrow');
    expect(countdown(5)).toBe('in 5 days');
    expect(countdown(21)).toBe('in 3 weeks');
    expect(countdown(90)).toBe('in 3 months');
  });
});

describe('daysBetween', () => {
  it('counts whole days either way', () => {
    expect(daysBetween('2026-11-09', '2026-11-12')).toBe(3);
    expect(daysBetween('2026-11-12', '2026-11-09')).toBe(-3);
  });

  it('crosses a month without drifting', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('gettingReady', () => {
  const packed = (n: number, done = 0) =>
    Array.from({ length: n }, (_, i) => ({ packed: i < done }));

  const keysFor = (stops: Stop[], packing: { packed: boolean }[]) =>
    gettingReady(stops, packing).map((i) => i.key);

  it('says nothing at all when the trip is ready', () => {
    // The point of the list: silence means ready, so it must be capable of
    // being silent. A block that always finds something to nag about is one
    // people stop reading.
    expect(gettingReady([stop({ dayDate: '2026-11-09' })], packed(3, 3))).toEqual([]);
  });

  it('asks for places before anything else on an empty trip', () => {
    expect(keysFor([], [])).toEqual(['stops-none', 'packing-none']);
  });

  it('does not ask for days on a trip that has no places', () => {
    // "0 places have no day yet" is true and useless.
    expect(keysFor([], packed(2, 2))).toEqual(['stops-none']);
  });

  it('counts the places with no day', () => {
    const stops = [
      stop({ id: 'a', dayDate: '2026-11-09' }),
      stop({ id: 'b', dayDate: null }),
      stop({ id: 'c', dayDate: null }),
    ];
    expect(gettingReady(stops, packed(1, 1))[0]).toEqual({
      key: 'stops-undated',
      label: '2 places have no day yet',
      icon: 'calendar-outline',
    });
  });

  it('reads as English for one place', () => {
    const stops = [stop({ id: 'a', dayDate: null })];
    expect(gettingReady(stops, packed(1, 1))[0].label).toBe('1 place has no day yet');
  });

  it('offers a packing list when there is none, and progress when there is', () => {
    expect(keysFor([stop({ dayDate: '2026-11-09' })], [])).toEqual(['packing-none']);
    const withList = gettingReady([stop({ dayDate: '2026-11-09' })], packed(5, 2));
    expect(withList).toHaveLength(1);
    expect(withList[0].label).toBe('3 still to pack');
  });

  it('drops the packing line once the bag is done', () => {
    expect(keysFor([stop({ dayDate: '2026-11-09' })], packed(4, 4))).toEqual([]);
  });
});

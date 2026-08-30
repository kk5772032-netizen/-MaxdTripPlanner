import { straightLineMetres, modeFor, type Leg } from '../api/routes';
import {
  formatDistance,
  formatTravel,
  overrunSummary,
  overruns,
  pairId,
  pairsForDay,
} from './travel';
import type { Stop } from '../types';

let seq = 0;
const stop = (o: Partial<Stop> = {}): Stop => ({
  id: `stop-${seq}`, tripId: 't', googlePlaceId: null, name: `Stop ${seq}`, address: null,
  lat: null, lng: null, rating: null, photoRef: null, sequence: seq++, dayDate: '2026-11-09',
  startTime: null, endTime: null, plannedBudgetMinor: null, notes: null, ...o,
});

beforeEach(() => {
  seq = 0;
});

const leg = (seconds: number, mode: Leg['mode'] = 'drive'): Leg => ({
  seconds, metres: seconds * 8, mode,
});

describe('straightLineMetres', () => {
  it('measures a known gap', () => {
    // India Gate to Red Fort is about 5.8 km as the crow flies.
    const m = straightLineMetres(
      { lat: 28.6129, lng: 77.2295 },
      { lat: 28.6562, lng: 77.2410 },
    );
    expect(m).toBeGreaterThan(4_500);
    expect(m).toBeLessThan(6_500);
  });

  it('is zero for a point and itself', () => {
    expect(straightLineMetres({ lat: 28.6, lng: 77.2 }, { lat: 28.6, lng: 77.2 })).toBe(0);
  });
});

describe('modeFor', () => {
  it('walks the short hops rather than paying for a driving answer', () => {
    expect(modeFor({ lat: 28.6129, lng: 77.2295 }, { lat: 28.6150, lng: 77.2300 })).toBe('walk');
  });

  it('drives anything across a city', () => {
    expect(modeFor({ lat: 28.6129, lng: 77.2295 }, { lat: 28.6562, lng: 77.2410 })).toBe('drive');
  });
});

describe('pairsForDay', () => {
  it('pairs consecutive stops that both know where they are', () => {
    const a = stop({ id: 'a', lat: 28.6, lng: 77.2 });
    const b = stop({ id: 'b', lat: 28.7, lng: 77.3 });
    expect(pairsForDay([a, b])).toHaveLength(1);
    expect(pairsForDay([a, b])[0]).toMatchObject({ fromId: 'a', toId: 'b' });
  });

  it('breaks the chain at a stop with no coordinates', () => {
    // Claiming a drive time from the museum to the restaurant when there is an
    // unplaced stop between them would be a made-up number.
    const a = stop({ id: 'a', lat: 28.6, lng: 77.2 });
    const typed = stop({ id: 'typed' });
    const c = stop({ id: 'c', lat: 28.7, lng: 77.3 });
    expect(pairsForDay([a, typed, c])).toEqual([]);
  });

  it('has nothing to say about a day with one stop', () => {
    expect(pairsForDay([stop({ lat: 28.6, lng: 77.2 })])).toEqual([]);
    expect(pairsForDay([])).toEqual([]);
  });
});

describe('formatTravel', () => {
  it('says minutes the way people do', () => {
    expect(formatTravel(leg(22 * 60))).toBe('22 min drive');
    expect(formatTravel(leg(8 * 60, 'walk'))).toBe('8 min walk');
  });

  it('rounds a very short leg up rather than to nothing', () => {
    expect(formatTravel(leg(20, 'walk'))).toBe('1 min walk');
  });

  it('breaks an hour out', () => {
    expect(formatTravel(leg(65 * 60))).toBe('1 hr 5 min drive');
    expect(formatTravel(leg(120 * 60))).toBe('2 hr drive');
  });

  it('says nothing when there is no leg', () => {
    expect(formatTravel(null)).toBeNull();
  });
});

describe('formatDistance', () => {
  it('is what can be said with no API key at all', () => {
    expect(formatDistance(420)).toBe('400 m apart');
    expect(formatDistance(5_800)).toBe('5.8 km apart');
    expect(formatDistance(42_000)).toBe('42 km apart');
  });

  it('says nothing for a distance it does not have', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(-1)).toBeNull();
  });
});

describe('overruns', () => {
  const legs = (pairs: Record<string, Leg | null>) => new Map(Object.entries(pairs));

  it('flags a gap the journey does not fit into', () => {
    const a = stop({ id: 'a', startTime: '10:00', endTime: '11:00' });
    const b = stop({ id: 'b', startTime: '11:10' });
    const found = overruns([a, b], legs({ [pairId('a', 'b')]: leg(30 * 60) }));
    expect(found).toEqual([{ fromId: 'a', toId: 'b', shortBy: 20 }]);
  });

  it('is quiet when the day allows for the journey', () => {
    const a = stop({ id: 'a', startTime: '10:00', endTime: '11:00' });
    const b = stop({ id: 'b', startTime: '12:00' });
    expect(overruns([a, b], legs({ [pairId('a', 'b')]: leg(30 * 60) }))).toEqual([]);
  });

  it('leaves from the start when a stop has no end time', () => {
    const a = stop({ id: 'a', startTime: '10:00' });
    const b = stop({ id: 'b', startTime: '10:15' });
    expect(overruns([a, b], legs({ [pairId('a', 'b')]: leg(30 * 60) }))).toEqual([
      { fromId: 'a', toId: 'b', shortBy: 15 },
    ]);
  });

  it('says nothing about untimed stops, which cannot be late', () => {
    const a = stop({ id: 'a' });
    const b = stop({ id: 'b', startTime: '11:00' });
    expect(overruns([a, b], legs({ [pairId('a', 'b')]: leg(30 * 60) }))).toEqual([]);
  });

  it('says nothing when the leg was never looked up', () => {
    const a = stop({ id: 'a', startTime: '10:00', endTime: '11:00' });
    const b = stop({ id: 'b', startTime: '11:10' });
    expect(overruns([a, b], legs({}))).toEqual([]);
    expect(overruns([a, b], legs({ [pairId('a', 'b')]: null }))).toEqual([]);
  });

  it('leaves overlapping times to the plan rather than blaming the journey', () => {
    const a = stop({ id: 'a', startTime: '10:00', endTime: '12:00' });
    const b = stop({ id: 'b', startTime: '11:00' });
    expect(overruns([a, b], legs({ [pairId('a', 'b')]: leg(10 * 60) }))).toEqual([]);
  });
});

describe('overrunSummary', () => {
  it('leads with the worst of them', () => {
    expect(
      overrunSummary([
        { fromId: 'a', toId: 'b', shortBy: 5 },
        { fromId: 'b', toId: 'c', shortBy: 40 },
      ]),
    ).toBe("Tight: 2 journeys don't fit, one by 40 minutes.");
  });

  it('reads naturally for one', () => {
    expect(overrunSummary([{ fromId: 'a', toId: 'b', shortBy: 1 }])).toBe(
      'Tight: this day is a minute short for one of its journeys.',
    );
  });

  it('says nothing when the day works', () => {
    expect(overrunSummary([])).toBeNull();
  });
});

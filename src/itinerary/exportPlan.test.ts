import { planAsHtml, planAsText, planFileName, type PlanData } from './exportPlan';
import type { Activity, Booking, FoodPlan, Stop, Trip } from '../types';

const trip: Trip = {
  id: 'trip-1',
  name: 'Delhi long weekend',
  startDate: '2026-11-09',
  endDate: '2026-11-11',
  currency: 'INR',
  totalBudgetMinor: 1_500_000,
  createdAt: '2026-08-01T00:00:00.000Z',
};

let seq = 0;
const stop = (o: Partial<Stop> = {}): Stop => ({
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
  ...o,
});

const booking = (o: Partial<Booking> = {}): Booking => ({
  id: 'booking-1',
  tripId: 'trip-1',
  kind: 'flight',
  title: 'DEL to BOM, AI 665',
  confirmation: null,
  startsAt: null,
  endsAt: null,
  location: null,
  costMinor: null,
  notes: null,
  attachmentUri: null,
  attachmentName: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...o,
});

const activity = (o: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  stopId: 'stop-0',
  title: 'Light show',
  estimatedCostMinor: null,
  done: false,
  startTime: null,
  durationMin: null,
  notes: null,
  ...o,
});

const food = (o: Partial<FoodPlan> = {}): FoodPlan => ({
  id: 'food-1',
  stopId: 'stop-0',
  googlePlaceId: null,
  name: "Karim's",
  cuisine: null,
  estimatedCostMinor: null,
  notes: null,
  ...o,
});

const empty: PlanData = { trip, stops: [], activities: [], foodPlans: [], bookings: [] };

beforeEach(() => {
  seq = 0;
});

describe('planAsText', () => {
  it('opens with the trip and its dates', () => {
    expect(planAsText(empty).split('\n').slice(0, 2)).toEqual([
      'Delhi long weekend',
      '9–11 Nov 2026',
    ]);
  });

  it('keeps empty days, so a gap in the plan is visible', () => {
    const text = planAsText(empty);
    expect(text).toContain('DAY 2 — TUE 10 NOV');
    expect(text).toContain('Nothing planned yet.');
  });

  it('lays a day out in clock order across bookings and stops', () => {
    const text = planAsText({
      ...empty,
      stops: [stop({ name: 'Red Fort', dayDate: '2026-11-09', startTime: '10:00' })],
      bookings: [booking({ startsAt: '2026-11-09T06:00', confirmation: 'PNR7Y2Q' })],
    });
    const day1 = text.slice(text.indexOf('DAY 1'), text.indexOf('DAY 2'));
    expect(day1.indexOf('DEL to BOM')).toBeLessThan(day1.indexOf('Red Fort'));
    expect(day1).toContain('6:00 am · Flight · DEL to BOM, AI 665');
    expect(day1).toContain('PNR7Y2Q');
  });

  it("carries a stop's to-dos and food, which is the point of sending it", () => {
    const text = planAsText({
      ...empty,
      stops: [stop({ name: 'Red Fort', dayDate: '2026-11-09' })],
      activities: [activity(), activity({ id: 'act-2', title: 'Museum wing' })],
      foodPlans: [food()],
    });
    expect(text).toContain('To do: Light show, Museum wing');
    expect(text).toContain("Food: Karim's");
  });

  it('lists undated bookings at the end rather than dropping them', () => {
    const text = planAsText({
      ...empty,
      bookings: [booking({ kind: 'lodging', title: 'Somewhere in Jaipur' })],
    });
    expect(text).toContain('BOOKED, NO DATE YET');
    expect(text).toContain('Stay · Somewhere in Jaipur');
  });

  it('does not put money in something you send to other people', () => {
    const text = planAsText({
      ...empty,
      bookings: [booking({ startsAt: '2026-11-09T06:00', costMinor: 850_000 })],
    });
    expect(text).not.toContain('8,500');
    expect(text).not.toContain('₹');
  });
});

describe('planAsHtml', () => {
  it('is a complete, self-contained document', () => {
    const html = planAsHtml(empty);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<style>');
    // A PDF renders with no network: a linked stylesheet would silently vanish.
    expect(html).not.toContain('<link');
    expect(html).not.toContain('http://');
  });

  it('escapes anything someone typed', () => {
    const html = planAsHtml({
      ...empty,
      stops: [stop({ name: '<script>alert(1)</script>', dayDate: '2026-11-09' })],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('marks a hotel checkout on the day you leave', () => {
    const html = planAsHtml({
      ...empty,
      bookings: [
        booking({
          kind: 'lodging',
          title: 'Hotel Broadway',
          startsAt: '2026-11-09T15:00',
          endsAt: '2026-11-11T11:00',
        }),
      ],
    });
    expect(html).toContain('Check out');
    expect(html.indexOf('Day 3')).toBeLessThan(html.lastIndexOf('Hotel Broadway'));
  });
});

describe('planFileName', () => {
  it('is a name someone can find again', () => {
    expect(planFileName(trip, 'pdf')).toBe('delhi-long-weekend.pdf');
  });

  it('survives a name with nothing usable in it', () => {
    expect(planFileName({ ...trip, name: '!!! ???' }, 'pdf')).toBe('trip.pdf');
  });
});

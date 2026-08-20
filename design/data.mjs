/**
 * The one trip every artboard is showing.
 *
 * Before this file the numbers were invented per screen, and they did not
 * survive being added up: the expense list summed to ₹15,150 under a ₹6,650
 * header, the trips card said ₹12,500 where the drill-in said ₹6,650, and a
 * push notification quoted a total that appeared nowhere else. A design that
 * can't be reconciled can't be reviewed — you can't tell a deliberate state
 * from a typo.
 *
 * So: one fixture, and every screen renders a projection of it. The totals
 * below are derived, not typed, which is what stops them drifting apart again.
 */

export const TRIP = {
  name: 'Delhi long weekend',
  dates: '6–9 Nov 2026',
  datesLong: '6 Nov – 9 Nov 2026',
  currency: 'INR',
  budget: 15000,
};

/**
 * Stops in sequence. `planned` is the sum of activity estimates and food
 * estimates — the app derives it the same way, which is why the stop screens
 * can't quote a planned figure that ignores the food tab.
 */
export const STOPS = [
  {
    n: 1,
    name: 'India Gate',
    address: 'Kartavya Path, New Delhi',
    rating: '4.6',
    cap: 2000,
    activities: [
      { name: 'Evening walk to the war memorial', est: 0, done: true },
      { name: "Boat ride at Children's Park", est: 400, done: false },
    ],
    food: [
      { name: "Karim's", cuisine: 'Mughlai', rating: '4.4', est: 1600 },
    ],
  },
  {
    n: 2,
    name: "Humayun's Tomb",
    address: 'Mathura Road, Nizamuddin',
    rating: '4.5',
    cap: 1500,
    activities: [{ name: 'Entry tickets × 2', est: 600, done: true }],
    food: [{ name: 'Andhra Bhavan', cuisine: 'South Indian', rating: '4.3', est: 700 }],
  },
  {
    n: 3,
    name: 'Connaught Place',
    address: 'Rajiv Chowk, New Delhi',
    rating: '4.3',
    cap: 4000,
    activities: [
      { name: 'Jantar Mantar', est: 300, done: false },
      { name: 'Shopping at Janpath', est: 1500, done: false },
    ],
    food: [
      { name: 'Saravana Bhavan', cuisine: 'South Indian', rating: '4.2', est: 900 },
      { name: "Wenger's", cuisine: 'Bakery', rating: '4.4', est: 400 },
    ],
  },
];

/** Expenses in the order the list shows them: newest first. */
export const EXPENSES = [
  { note: 'Hotel · 2 nights', cat: 'lodging', stop: null, amount: 5400, date: '9 Nov 2026' },
  { note: 'Janpath shopping', cat: 'other', stop: 'Connaught Place', amount: 1600, date: '8 Nov 2026' },
  { note: 'Saravana Bhavan', cat: 'food', stop: 'Connaught Place', amount: 880, date: '8 Nov 2026' },
  { note: 'Entry tickets × 2', cat: 'activity', stop: "Humayun's Tomb", amount: 1120, date: '7 Nov 2026' },
  { note: 'Andhra Bhavan thali', cat: 'food', stop: "Humayun's Tomb", amount: 600, date: '7 Nov 2026' },
  { note: "Lunch at Karim's", cat: 'food', stop: 'India Gate', amount: 1450, date: '6 Nov 2026' },
  { note: 'Boat ride', cat: 'activity', stop: 'India Gate', amount: 400, date: '6 Nov 2026' },
  { note: 'Airport cab', cat: 'transport', stop: null, amount: 800, date: '6 Nov 2026' },
  { note: 'Metro cards × 2', cat: 'transport', stop: null, amount: 300, date: '6 Nov 2026' },
];

const sum = (ns) => ns.reduce((a, b) => a + b, 0);

/** Everything below is derived. Nothing here is a typed-in total. */
export const plannedFor = (stop) =>
  sum(stop.activities.map((a) => a.est)) + sum(stop.food.map((f) => f.est));

export const actualFor = (name) =>
  sum(EXPENSES.filter((e) => e.stop === name).map((e) => e.amount));

/** The app's thresholds: amber from 80% of the cap, red past it. */
export const statusOf = (actual, cap) => {
  if (cap === null || cap === undefined) return 'unset';
  if (actual > cap) return 'over';
  return actual * 5 >= cap * 4 ? 'near' : 'under';
};

export const stopRows = STOPS.map((s) => {
  const actual = actualFor(s.name);
  return { ...s, planned: plannedFor(s), actual, status: statusOf(actual, s.cap) };
});

export const UNTIED = sum(EXPENSES.filter((e) => e.stop === null).map((e) => e.amount));

export const TOTALS = {
  budget: TRIP.budget,
  planned: sum(stopRows.map((s) => s.planned)),
  actual: sum(EXPENSES.map((e) => e.amount)),
  count: EXPENSES.length,
};
TOTALS.remaining = TOTALS.budget - TOTALS.actual;
TOTALS.percent = Math.round((TOTALS.actual / TOTALS.budget) * 100);
TOTALS.status = statusOf(TOTALS.actual, TOTALS.budget);

/** Largest first, the way the app orders its slices and its legend. */
export const BY_CATEGORY = ['food', 'activity', 'transport', 'lodging', 'other']
  .map((cat) => {
    const amount = sum(EXPENSES.filter((e) => e.cat === cat).map((e) => e.amount));
    return { cat, amount, share: Math.round((amount / TOTALS.actual) * 100) };
  })
  .filter((c) => c.amount > 0)
  .sort((a, b) => b.amount - a.amount);

export const BIGGEST = EXPENSES.reduce((a, b) => (b.amount > a.amount ? b : a));

/** ₹1,23,456 — Indian digit grouping, as `formatMoney` produces it. */
export function money(n, { paise = false } = {}) {
  const whole = Math.trunc(Math.abs(n));
  const s = String(whole);
  const head = s.slice(0, -3);
  const tail = s.slice(-3);
  const grouped = head ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail : tail;
  return `${n < 0 ? '-' : ''}₹${grouped}${paise ? '.00' : ''}`;
}

export const CATEGORY_LABEL = {
  food: 'Food', activity: 'Activity', transport: 'Transport',
  lodging: 'Lodging', other: 'Other',
};

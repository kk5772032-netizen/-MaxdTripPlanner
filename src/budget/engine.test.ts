import {
  actualByCategory,
  progressRatio,
  statusFor,
  stopActual,
  stopPlanned,
  stopStatus,
  stopSummary,
  tripTotals,
  tripWarning,
} from './engine';
import { formatMoney, parseMoney, sumMinor, toDecimalString } from './money';
import type { Activity, Expense, ExpenseCategory, FoodPlan, Stop, Trip } from '../types';

/* ---------------------------------------------------------------- fixtures */

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    name: 'Delhi weekend',
    startDate: '2025-11-01',
    endDate: '2025-11-03',
    currency: 'INR',
    totalBudgetMinor: 10_000_00,
    createdAt: '2025-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeStop(overrides: Partial<Stop> = {}): Stop {
  return {
    id: 'stop-1',
    tripId: 'trip-1',
    googlePlaceId: null,
    name: 'India Gate',
    address: null,
    lat: null,
    lng: null,
    rating: null,
    photoRef: null,
    sequence: 0,
    plannedBudgetMinor: 1_000_00,
    notes: null,
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    stopId: 'stop-1',
    title: 'Walk the memorial',
    estimatedCostMinor: null,
    done: false,
    ...overrides,
  };
}

function makeFoodPlan(overrides: Partial<FoodPlan> = {}): FoodPlan {
  return {
    id: 'food-1',
    stopId: 'stop-1',
    googlePlaceId: null,
    name: "Karim's",
    cuisine: null,
    estimatedCostMinor: null,
    notes: null,
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    tripId: 'trip-1',
    stopId: 'stop-1',
    category: 'food',
    amountMinor: 100_00,
    note: null,
    spentAt: '2025-11-01',
    ...overrides,
  };
}

/* ------------------------------------------------------------------- money */

describe('money', () => {
  it('parses decimal input into minor units', () => {
    expect(parseMoney('1250.50', 'INR')).toBe(125_050);
    expect(parseMoney('1,250', 'INR')).toBe(125_000);
    expect(parseMoney('₹99.99', 'INR')).toBe(9_999);
  });

  it('returns null rather than zero for empty or unparseable input', () => {
    // Null and zero mean different things: "no cap set" vs "a cap of nothing".
    expect(parseMoney('', 'INR')).toBeNull();
    expect(parseMoney('   ', 'INR')).toBeNull();
    expect(parseMoney('abc', 'INR')).toBeNull();
    expect(parseMoney('.', 'INR')).toBeNull();
    expect(parseMoney('0', 'INR')).toBe(0);
  });

  it('respects currencies with no minor unit', () => {
    expect(parseMoney('1250', 'JPY')).toBe(1250);
    expect(toDecimalString(1250, 'JPY')).toBe('1250');
    expect(formatMoney(1250, 'JPY')).toBe('¥1,250');
  });

  it('rounds half-cent input without float drift', () => {
    // 1.005 * 100 is 100.49999999999999 in IEEE 754.
    expect(parseMoney('1.005', 'USD')).toBe(101);
    expect(parseMoney('0.145', 'USD')).toBe(15);
  });

  it('groups INR digits as lakhs and crores', () => {
    expect(formatMoney(1_234_567_00, 'INR', { compact: true })).toBe('₹12,34,567');
    expect(formatMoney(1_234_567_00, 'USD', { compact: true })).toBe('$1,234,567');
  });

  it('round-trips through toDecimalString and parseMoney', () => {
    for (const minor of [0, 1, 99, 100, 12_345, 1_000_000]) {
      expect(parseMoney(toDecimalString(minor, 'INR'), 'INR')).toBe(minor);
    }
  });

  it('ignores nulls when summing', () => {
    expect(sumMinor([100, null, 200, undefined])).toBe(300);
    expect(sumMinor([])).toBe(0);
  });
});

/* --------------------------------------------------------- status thresholds */

describe('statusFor', () => {
  const cap = 1_000_00; // ₹1000

  it('is under below 80%', () => {
    expect(statusFor(0, cap)).toBe('under');
    // 79.9% of the cap.
    expect(statusFor(79_900, cap)).toBe('under');
  });

  it('is near from exactly 80% up to and including the cap', () => {
    expect(statusFor(80_000, cap)).toBe('near'); // exactly 80%
    expect(statusFor(99_999, cap)).toBe('near');
    expect(statusFor(cap, cap)).toBe('near'); // exactly 100% is not overspending
  });

  it('is over only past the cap', () => {
    expect(statusFor(cap + 1, cap)).toBe('over'); // 100.001%
    expect(statusFor(100_100, cap)).toBe('over'); // 100.1%
    expect(statusFor(cap * 3, cap)).toBe('over');
  });

  it('is unset when there is no cap, or the cap is zero', () => {
    expect(statusFor(0, null)).toBe('unset');
    expect(statusFor(50_000, null)).toBe('unset');
    // A cap of zero has no meaningful ratio — treat it as unset, not instantly over.
    expect(statusFor(0, 0)).toBe('unset');
    expect(statusFor(1, 0)).toBe('unset');
  });

  it('holds the 80% boundary exactly for caps that do not divide evenly', () => {
    // 80% of 333 is 266.4, so 266 is under and 267 is near. A float ratio would
    // make this comparison fragile; the engine cross-multiplies instead.
    expect(statusFor(266, 333)).toBe('under');
    expect(statusFor(267, 333)).toBe('near');
  });
});

describe('progressRatio', () => {
  it('clamps to [0, 1]', () => {
    expect(progressRatio(0, 100)).toBe(0);
    expect(progressRatio(50, 100)).toBe(0.5);
    expect(progressRatio(500, 100)).toBe(1);
    expect(progressRatio(-50, 100)).toBe(0);
  });

  it('is zero when there is no cap', () => {
    expect(progressRatio(500, null)).toBe(0);
    expect(progressRatio(500, 0)).toBe(0);
  });
});

/* ---------------------------------------------------------------- per-stop */

describe('stopPlanned', () => {
  const stop = makeStop();

  it('sums activity and food estimates', () => {
    const activities = [
      makeActivity({ id: 'a1', estimatedCostMinor: 200_00 }),
      makeActivity({ id: 'a2', estimatedCostMinor: 50_00 }),
    ];
    const food = [makeFoodPlan({ id: 'f1', estimatedCostMinor: 300_00 })];
    expect(stopPlanned(stop, activities, food)).toBe(550_00);
  });

  it('treats a missing estimate as not counted, not as zero cost', () => {
    const activities = [
      makeActivity({ id: 'a1', estimatedCostMinor: 200_00 }),
      makeActivity({ id: 'a2', estimatedCostMinor: null }),
    ];
    expect(stopPlanned(stop, activities, [])).toBe(200_00);
  });

  it('ignores rows belonging to other stops', () => {
    const activities = [
      makeActivity({ id: 'a1', estimatedCostMinor: 200_00 }),
      makeActivity({ id: 'a2', stopId: 'stop-2', estimatedCostMinor: 999_00 }),
    ];
    expect(stopPlanned(stop, activities, [])).toBe(200_00);
  });

  it('is zero with nothing planned', () => {
    expect(stopPlanned(stop, [], [])).toBe(0);
  });
});

describe('stopActual', () => {
  it('sums only this stop’s expenses', () => {
    const stop = makeStop();
    const expenses = [
      makeExpense({ id: 'e1', amountMinor: 100_00 }),
      makeExpense({ id: 'e2', stopId: 'stop-2', amountMinor: 500_00 }),
      makeExpense({ id: 'e3', stopId: null, amountMinor: 900_00 }),
    ];
    expect(stopActual(stop, expenses)).toBe(100_00);
  });
});

describe('stopStatus', () => {
  it('handles a null planned_budget gracefully', () => {
    const stop = makeStop({ plannedBudgetMinor: null });
    expect(stopStatus(stop, 0)).toBe('unset');
    expect(stopStatus(stop, 5_000_00)).toBe('unset');
  });
});

describe('stopSummary', () => {
  it('reports remaining as null when no cap is set', () => {
    const stop = makeStop({ plannedBudgetMinor: null });
    const summary = stopSummary(stop, [], [], [makeExpense({ amountMinor: 100_00 })]);
    expect(summary.remaining).toBeNull();
    expect(summary.actual).toBe(100_00);
    expect(summary.status).toBe('unset');
  });

  it('reports a negative remaining when over the cap', () => {
    const stop = makeStop({ plannedBudgetMinor: 100_00 });
    const summary = stopSummary(stop, [], [], [makeExpense({ amountMinor: 150_00 })]);
    expect(summary.remaining).toBe(-50_00);
    expect(summary.status).toBe('over');
  });
});

/* ------------------------------------------------------------- trip totals */

describe('tripTotals', () => {
  const stops = [
    makeStop({ id: 'stop-1', sequence: 0, plannedBudgetMinor: 1_000_00 }),
    makeStop({ id: 'stop-2', sequence: 1, plannedBudgetMinor: 2_000_00 }),
  ];

  it('sums planned and actual across stops', () => {
    const activities = [makeActivity({ stopId: 'stop-1', estimatedCostMinor: 300_00 })];
    const food = [makeFoodPlan({ stopId: 'stop-2', estimatedCostMinor: 700_00 })];
    const expenses = [
      makeExpense({ id: 'e1', stopId: 'stop-1', amountMinor: 400_00 }),
      makeExpense({ id: 'e2', stopId: 'stop-2', amountMinor: 600_00 }),
    ];

    const totals = tripTotals(makeTrip(), stops, activities, food, expenses);
    expect(totals.totalPlanned).toBe(1_000_00);
    expect(totals.totalActual).toBe(1_000_00);
    expect(totals.remainingBudget).toBe(9_000_00);
    expect(totals.status).toBe('under');
  });

  it('counts trip-level expenses in the total but against no stop', () => {
    const expenses = [
      makeExpense({ id: 'e1', stopId: 'stop-1', amountMinor: 400_00 }),
      makeExpense({ id: 'e2', stopId: null, category: 'transport', amountMinor: 5_000_00 }),
    ];

    const totals = tripTotals(makeTrip(), stops, [], [], expenses);
    expect(totals.totalActual).toBe(5_400_00);
    expect(totals.unassignedActual).toBe(5_000_00);
    // The flight doesn't push either stop over its own cap.
    expect(totals.stops.map((s) => s.actual)).toEqual([400_00, 0]);
    expect(totals.overspentStops).toHaveLength(0);
  });

  it('returns stops in itinerary order regardless of input order', () => {
    const shuffled = [stops[1], stops[0]];
    const totals = tripTotals(makeTrip(), shuffled, [], [], []);
    expect(totals.stops.map((s) => s.stop.id)).toEqual(['stop-1', 'stop-2']);
  });

  it('handles a trip with no budget set', () => {
    const totals = tripTotals(makeTrip({ totalBudgetMinor: null }), stops, [], [], []);
    expect(totals.totalBudget).toBeNull();
    expect(totals.remainingBudget).toBeNull();
    expect(totals.status).toBe('unset');
  });

  it('lists every overspent stop', () => {
    const expenses = [
      makeExpense({ id: 'e1', stopId: 'stop-1', amountMinor: 1_500_00 }),
      makeExpense({ id: 'e2', stopId: 'stop-2', amountMinor: 2_500_00 }),
    ];
    const totals = tripTotals(makeTrip(), stops, [], [], expenses);
    expect(totals.overspentStops.map((s) => s.stop.id)).toEqual(['stop-1', 'stop-2']);
  });
});

/* ---------------------------------------------------- integer money, no drift */

describe('integer money math', () => {
  it('does not drift over many small expenses', () => {
    // 10,000 expenses of ₹0.10. In float arithmetic 0.1 has no exact binary
    // representation and summing it 10,000 times lands near 1000.0000000001589.
    const expenses = Array.from({ length: 10_000 }, (_, i) =>
      makeExpense({ id: `e${i}`, amountMinor: 10 }),
    );

    const totals = tripTotals(makeTrip(), [makeStop()], [], [], expenses);
    expect(totals.totalActual).toBe(100_000);
    expect(formatMoney(totals.totalActual, 'INR')).toBe('₹1,000.00');

    // The same sum done in rupees as floats, for contrast.
    const asFloat = expenses.reduce((sum, e) => sum + e.amountMinor / 100, 0);
    expect(asFloat).not.toBe(1000);
  });

  it('keeps repeated third-of-a-rupee amounts exact', () => {
    const expenses = Array.from({ length: 3 }, (_, i) =>
      makeExpense({ id: `e${i}`, amountMinor: 3_333 }),
    );
    const totals = tripTotals(makeTrip(), [makeStop()], [], [], expenses);
    expect(totals.totalActual).toBe(9_999);
  });
});

/* ------------------------------------------------------------- by category */

describe('actualByCategory', () => {
  it('totals each category and leaves the rest at zero', () => {
    const expenses = [
      makeExpense({ id: 'e1', category: 'food', amountMinor: 100_00 }),
      makeExpense({ id: 'e2', category: 'food', amountMinor: 50_00 }),
      makeExpense({ id: 'e3', category: 'transport', amountMinor: 200_00 }),
    ];

    const totals = actualByCategory(expenses);
    expect(totals.food).toBe(150_00);
    expect(totals.transport).toBe(200_00);
    expect(totals.activity).toBe(0);
    expect(totals.lodging).toBe(0);
    expect(totals.other).toBe(0);
  });

  it('covers every category in the union type', () => {
    const categories: ExpenseCategory[] = [
      'food',
      'activity',
      'transport',
      'lodging',
      'other',
    ];
    const totals = actualByCategory([]);
    for (const category of categories) {
      expect(totals[category]).toBe(0);
    }
  });
});

/* ----------------------------------------------------------------- warning */

describe('tripWarning', () => {
  const stops = [makeStop({ id: 'stop-1', plannedBudgetMinor: 1_000_00 })];

  it('says nothing when everything is comfortably under', () => {
    const totals = tripTotals(makeTrip(), stops, [], [], []);
    expect(tripWarning(totals)).toBeNull();
  });

  it('leads with the trip being over its own budget', () => {
    const expenses = [makeExpense({ amountMinor: 20_000_00 })];
    const totals = tripTotals(makeTrip(), stops, [], [], expenses);
    expect(tripWarning(totals)).toBe('This trip is over its total budget.');
  });

  it('names a single overspent stop', () => {
    const expenses = [makeExpense({ amountMinor: 1_500_00 })];
    const totals = tripTotals(makeTrip(), stops, [], [], expenses);
    expect(tripWarning(totals)).toBe('India Gate is over its budget.');
  });

  it('counts multiple overspent stops', () => {
    const twoStops = [
      makeStop({ id: 'stop-1', sequence: 0, plannedBudgetMinor: 100_00 }),
      makeStop({ id: 'stop-2', sequence: 1, plannedBudgetMinor: 100_00 }),
    ];
    const expenses = [
      makeExpense({ id: 'e1', stopId: 'stop-1', amountMinor: 200_00 }),
      makeExpense({ id: 'e2', stopId: 'stop-2', amountMinor: 200_00 }),
    ];
    const totals = tripTotals(makeTrip(), twoStops, [], [], expenses);
    expect(tripWarning(totals)).toBe('2 stops are over budget.');
  });

  it('warns when the plan alone already exceeds the budget', () => {
    const activities = [makeActivity({ estimatedCostMinor: 50_000_00 })];
    const totals = tripTotals(makeTrip(), stops, activities, [], []);
    expect(tripWarning(totals)).toBe('Your plan already costs more than the trip budget.');
  });
});

import type {
  Activity,
  BudgetStatus,
  Expense,
  ExpenseCategory,
  FoodPlan,
  Stop,
  Trip,
} from '../types';
import { sumMinor } from './money';

/**
 * Budget maths.
 *
 * Every function here is pure and works in integer minor units, so results are
 * exact no matter how many small expenses are summed. Nothing in this file
 * touches SQLite, the store, or React.
 *
 * Three different numbers get confused easily, so to be explicit:
 *   - **budget** — the cap the user set (`stop.plannedBudgetMinor`,
 *     `trip.totalBudgetMinor`). May be null: "I haven't decided."
 *   - **planned** — what the user intends to spend, derived from the estimated
 *     costs on activities and food plans.
 *   - **actual** — what they've actually logged as expenses.
 *
 * Status compares *actual against the cap*, because that's the number that
 * matters while the trip is happening.
 */

/** Actual/cap ratio at which a stop is flagged amber. */
export const NEAR_THRESHOLD = 0.8;

/** Sum of the estimated costs the user has planned for a stop. */
export function stopPlanned(
  stop: Stop,
  activities: Activity[],
  foodPlans: FoodPlan[],
): number {
  return (
    sumMinor(activities.filter((a) => a.stopId === stop.id).map((a) => a.estimatedCostMinor)) +
    sumMinor(foodPlans.filter((f) => f.stopId === stop.id).map((f) => f.estimatedCostMinor))
  );
}

/** Sum of expenses logged against a stop. */
export function stopActual(stop: Stop, expenses: Expense[]): number {
  return sumMinor(expenses.filter((e) => e.stopId === stop.id).map((e) => e.amountMinor));
}

/**
 * Where `actual` sits against the stop's cap.
 *
 * Boundaries, stated once so they're not re-derived from the code:
 *   - no cap set, or a cap of zero        -> 'unset'
 *   - actual/cap  <  0.8                  -> 'under'
 *   - 0.8 <= actual/cap <= 1.0            -> 'near'
 *   - actual/cap  >  1.0                  -> 'over'
 *
 * Exactly on the cap is 'near', not 'over' — spending your whole budget is not
 * overspending. Compared with cross-multiplication rather than division so
 * there's no float in the comparison at all.
 */
export function stopStatus(stop: Stop, actual: number): BudgetStatus {
  return statusFor(actual, stop.plannedBudgetMinor);
}

/** The same comparison, for any actual/cap pair. */
export function statusFor(actual: number, cap: number | null): BudgetStatus {
  if (cap === null || cap <= 0) return 'unset';
  if (actual > cap) return 'over';
  // actual >= 0.8 * cap, done as 10*actual >= 8*cap to stay in integers.
  if (actual * 10 >= cap * 8) return 'near';
  return 'under';
}

/** Progress against a cap, clamped to [0, 1]. Null cap -> 0. */
export function progressRatio(actual: number, cap: number | null): number {
  if (cap === null || cap <= 0) return 0;
  return Math.min(1, Math.max(0, actual / cap));
}

export interface StopSummary {
  stop: Stop;
  /** The cap, echoed for convenience. */
  budget: number | null;
  planned: number;
  actual: number;
  status: BudgetStatus;
  /** Cap minus actual. Null when no cap is set. Negative when over. */
  remaining: number | null;
}

export function stopSummary(
  stop: Stop,
  activities: Activity[],
  foodPlans: FoodPlan[],
  expenses: Expense[],
): StopSummary {
  const planned = stopPlanned(stop, activities, foodPlans);
  const actual = stopActual(stop, expenses);
  return {
    stop,
    budget: stop.plannedBudgetMinor,
    planned,
    actual,
    status: stopStatus(stop, actual),
    remaining: stop.plannedBudgetMinor === null ? null : stop.plannedBudgetMinor - actual,
  };
}

export interface TripTotals {
  /** The trip-level cap. Null when the user didn't set one. */
  totalBudget: number | null;
  /** Everything planned across all stops. */
  totalPlanned: number;
  /** Everything logged, including trip-level expenses with no stop. */
  totalActual: number;
  /** Budget minus actual. Null when no budget is set; negative when over. */
  remainingBudget: number | null;
  status: BudgetStatus;
  /** Per-stop breakdown, in itinerary order. */
  stops: StopSummary[];
  /** Expenses not tied to any stop — flights, visas, and so on. */
  unassignedActual: number;
  /** Stops whose actual has passed their own cap. */
  overspentStops: StopSummary[];
}

export function tripTotals(
  trip: Trip,
  stops: Stop[],
  activities: Activity[],
  foodPlans: FoodPlan[],
  expenses: Expense[],
): TripTotals {
  const summaries = stops
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => stopSummary(stop, activities, foodPlans, expenses));

  // Summed over every expense rather than over the per-stop actuals, so
  // trip-level expenses (stop_id NULL) are counted too.
  const totalActual = sumMinor(expenses.map((e) => e.amountMinor));
  const totalPlanned = sumMinor(summaries.map((s) => s.planned));
  const unassignedActual = sumMinor(
    expenses.filter((e) => e.stopId === null).map((e) => e.amountMinor),
  );

  return {
    totalBudget: trip.totalBudgetMinor,
    totalPlanned,
    totalActual,
    remainingBudget:
      trip.totalBudgetMinor === null ? null : trip.totalBudgetMinor - totalActual,
    status: statusFor(totalActual, trip.totalBudgetMinor),
    stops: summaries,
    unassignedActual,
    overspentStops: summaries.filter((s) => s.status === 'over'),
  };
}

/** Actual spend per category, for the dashboard pie. Zero categories omitted. */
export function actualByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
  const totals = {
    food: 0,
    activity: 0,
    transport: 0,
    lodging: 0,
    other: 0,
  } as Record<ExpenseCategory, number>;

  for (const expense of expenses) {
    totals[expense.category] += expense.amountMinor;
  }
  return totals;
}

/**
 * A short sentence for the trip-level warning banner, or null when there's
 * nothing worth saying.
 */
export function tripWarning(totals: TripTotals): string | null {
  if (totals.status === 'over') {
    return 'This trip is over its total budget.';
  }
  if (totals.status === 'near') {
    return 'This trip is close to its total budget.';
  }
  if (totals.overspentStops.length === 1) {
    return `${totals.overspentStops[0].stop.name} is over its budget.`;
  }
  if (totals.overspentStops.length > 1) {
    return `${totals.overspentStops.length} stops are over budget.`;
  }
  // Nothing has been overspent yet, but the plan already exceeds the budget.
  if (
    totals.totalBudget !== null &&
    totals.totalPlanned > totals.totalBudget &&
    totals.totalBudget > 0
  ) {
    return 'Your plan already costs more than the trip budget.';
  }
  return null;
}

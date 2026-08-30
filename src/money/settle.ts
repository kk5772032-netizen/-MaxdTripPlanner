/**
 * Who owes whom, at the end of a trip.
 *
 * Every figure here is an integer number of minor units, like the rest of the
 * money in this app, and that is load-bearing rather than stylistic: splitting
 * ₹100 three ways is 33.34 + 33.33 + 33.33, and any approach that rounds each
 * share independently loses or invents a paisa. The tests check that shares sum
 * back to the total exactly, because a settle-up that is a penny out is a
 * settle-up somebody argues with.
 */

export interface Traveller {
  id: string;
  name: string;
}

export interface Shareable {
  id: string;
  amountMinor: number;
  /** Who actually paid. Null means nobody said, so it settles nothing. */
  paidBy: string | null;
  /**
   * Who it was for. Null or empty means everyone on the trip — the common case,
   * and the one people should not have to tick boxes for.
   */
  sharedWith: string[] | null;
}

export interface Balance {
  travellerId: string;
  /** Positive: they are owed. Negative: they owe. Sums to zero across a trip. */
  netMinor: number;
  /** What they paid out. */
  paidMinor: number;
  /** What they consumed. */
  oweMinor: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amountMinor: number;
}

/**
 * Divides an amount into `n` parts that sum back to exactly the amount.
 *
 * The remainder goes one unit at a time to the earliest shares rather than
 * being dropped or dumped on one person. Someone has to be a paisa worse off;
 * spreading it keeps the difference to the smallest unit that exists.
 */
export function splitEvenly(amountMinor: number, n: number): number[] {
  if (n <= 0) return [];
  const sign = amountMinor < 0 ? -1 : 1;
  const total = Math.abs(amountMinor);
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => sign * (base + (i < remainder ? 1 : 0)));
}

/** Who the expense was actually for, defaulting to everybody. */
function sharersOf(expense: Shareable, travellers: Traveller[]): string[] {
  const known = new Set(travellers.map((t) => t.id));
  const named = (expense.sharedWith ?? []).filter((id) => known.has(id));
  return named.length > 0 ? named : travellers.map((t) => t.id);
}

/**
 * What each person paid, consumed, and is therefore owed or owes.
 *
 * An expense with no payer is left out of the settle-up entirely. It still
 * counts as trip spending — it is in the budget — but it cannot move money
 * between people when nobody has said whose money it was.
 */
export function balances(travellers: Traveller[], expenses: Shareable[]): Balance[] {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const t of travellers) {
    paid.set(t.id, 0);
    owed.set(t.id, 0);
  }

  for (const expense of expenses) {
    if (!expense.paidBy || !paid.has(expense.paidBy)) continue;

    const sharers = sharersOf(expense, travellers);
    if (sharers.length === 0) continue;

    paid.set(expense.paidBy, paid.get(expense.paidBy)! + expense.amountMinor);

    const shares = splitEvenly(expense.amountMinor, sharers.length);
    sharers.forEach((id, i) => owed.set(id, owed.get(id)! + shares[i]));
  }

  return travellers.map((t) => ({
    travellerId: t.id,
    paidMinor: paid.get(t.id)!,
    oweMinor: owed.get(t.id)!,
    netMinor: paid.get(t.id)! - owed.get(t.id)!,
  }));
}

/**
 * The fewest payments that settle everyone up.
 *
 * Greedy: repeatedly send the largest debt to the largest credit. That is not
 * always the theoretical minimum number of transfers — finding that is
 * NP-hard — but it is within one of it in practice and, more importantly, it
 * is explainable. "Pay the person you owe the most" is a rule anybody can
 * check; a clever answer nobody can verify is worse at a dinner table.
 *
 * Amounts are integers throughout, so the transfers sum to zero exactly.
 */
export function settle(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netMinor < 0)
    .map((b) => ({ id: b.travellerId, amount: -b.netMinor }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.netMinor > 0)
    .map((b) => ({ id: b.travellerId, amount: b.netMinor }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amountMinor: amount });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return transfers;
}

/** True when nobody owes anybody — an empty trip, or one already square. */
export function isSettled(transfers: Transfer[]): boolean {
  return transfers.length === 0;
}

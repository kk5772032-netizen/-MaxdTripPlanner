import type { Expense, ExpenseCategory } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';
import { stamp, tombstone, unTombstone } from '../../sync/stamping';

interface ExpenseRow {
  id: string;
  trip_id: string;
  stop_id: string | null;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
  spent_at: string;
  booking_id: string | null;
  paid_by: string | null;
  shared_with: string | null;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    stopId: row.stop_id,
    category: row.category,
    amountMinor: row.amount,
    note: row.note,
    spentAt: row.spent_at,
    bookingId: row.booking_id ?? null,
    paidBy: row.paid_by ?? null,
    sharedWith: parseSharedWith(row.shared_with),
  };
}

/**
 * A stored JSON array, or null for "everyone". Anything unreadable is treated
 * as everyone: a share list that fails to parse should not quietly exclude
 * people from a bill.
 */
function parseSharedWith(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')
      ? (parsed as string[])
      : null;
  } catch {
    return null;
  }
}

/** Most expenses are typed by hand, split with everyone, and settle nothing. */
export type NewExpense = Omit<Expense, 'id' | 'bookingId' | 'paidBy' | 'sharedWith'> &
  Partial<Pick<Expense, 'bookingId' | 'paidBy' | 'sharedWith'>>;

export async function createExpense(input: NewExpense): Promise<Expense> {
  const db = await getDb();
  const expense: Expense = {
    bookingId: null,
    paidBy: null,
    sharedWith: null,
    ...input,
    id: newId(),
  };
  await db.runAsync(
    `INSERT INTO expenses
       (id, trip_id, stop_id, category, amount, note, spent_at, booking_id,
        paid_by, shared_with, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    expense.id,
    expense.tripId,
    expense.stopId,
    expense.category,
    expense.amountMinor,
    expense.note,
    expense.spentAt,
    expense.bookingId,
    expense.paidBy,
    expense.sharedWith ? JSON.stringify(expense.sharedWith) : null,
    await stamp(),
  );
  return expense;
}

/**
 * Re-inserts a deleted expense with its original id, so an undo restores the
 * exact row rather than a copy.
 */
export async function restoreExpense(expense: Expense): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO expenses
       (id, trip_id, stop_id, category, amount, note, spent_at, booking_id,
        paid_by, shared_with, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    expense.id, expense.tripId, expense.stopId, expense.category,
    expense.amountMinor, expense.note, expense.spentAt, expense.bookingId,
    expense.paidBy, expense.sharedWith ? JSON.stringify(expense.sharedWith) : null,
    await stamp(),
  );
  await unTombstone('expenses', expense.id);
}

export async function listExpenses(tripId: string): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses WHERE trip_id = ? ORDER BY spent_at DESC, rowid DESC`,
    tripId,
  );
  return rows.map(toExpense);
}

export async function listExpensesForStop(stopId: string): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses WHERE stop_id = ? ORDER BY spent_at DESC, rowid DESC`,
    stopId,
  );
  return rows.map(toExpense);
}

/**
 * Total logged spend per trip, keyed by trip id.
 *
 * Summed in SQLite rather than by loading every expense — the trip list only
 * needs the number, and a trip with a long log shouldn't cost anything extra
 * to render there.
 */
export async function totalsByTrip(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ trip_id: string; total: number }>(
    `SELECT trip_id, SUM(amount) AS total FROM expenses GROUP BY trip_id`,
  );
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.trip_id] = row.total ?? 0;
  return totals;
}

export async function getExpense(id: string): Promise<Expense | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ExpenseRow>(`SELECT * FROM expenses WHERE id = ?`, id);
  return row ? toExpense(row) : null;
}

export async function updateExpense(
  id: string,
  patch: Partial<Omit<Expense, 'id' | 'tripId'>>,
): Promise<Expense | null> {
  const existing = await getExpense(id);
  if (!existing) return null;

  const next: Expense = { ...existing, ...patch };
  const db = await getDb();
  await db.runAsync(
    `UPDATE expenses
        SET stop_id = ?, category = ?, amount = ?, note = ?, spent_at = ?, booking_id = ?,
            paid_by = ?, shared_with = ?, updated_at = ?
      WHERE id = ?`,
    next.stopId,
    next.category,
    next.amountMinor,
    next.note,
    next.spentAt,
    next.bookingId,
    next.paidBy,
    next.sharedWith ? JSON.stringify(next.sharedWith) : null,
    await stamp(),
    id,
  );
  return next;
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM expenses WHERE id = ?`, id);
  await tombstone('expenses', id);
}

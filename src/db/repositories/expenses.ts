import type { Expense, ExpenseCategory } from '../../types';
import { getDb } from '../client';
import { newId } from '../ids';

interface ExpenseRow {
  id: string;
  trip_id: string;
  stop_id: string | null;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
  spent_at: string;
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
  };
}

export type NewExpense = Omit<Expense, 'id'>;

export async function createExpense(input: NewExpense): Promise<Expense> {
  const db = await getDb();
  const expense: Expense = { ...input, id: newId() };
  await db.runAsync(
    `INSERT INTO expenses (id, trip_id, stop_id, category, amount, note, spent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    expense.id,
    expense.tripId,
    expense.stopId,
    expense.category,
    expense.amountMinor,
    expense.note,
    expense.spentAt,
  );
  return expense;
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
    `UPDATE expenses SET stop_id = ?, category = ?, amount = ?, note = ?, spent_at = ? WHERE id = ?`,
    next.stopId,
    next.category,
    next.amountMinor,
    next.note,
    next.spentAt,
    id,
  );
  return next;
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM expenses WHERE id = ?`, id);
}

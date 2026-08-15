/** Date helpers. All stored dates are ISO `YYYY-MM-DD` strings, no timezones. */

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True for a well-formed, real calendar date. Rejects '2025-02-30'. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  );
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** '2025-11-04' -> '4 Nov 2025'. */
export function formatDate(iso: string | null): string {
  if (!iso || !isValidIsoDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** A trip's date range, collapsing a shared month or year. */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'No dates set';
  if (start && !end) return `From ${formatDate(start)}`;
  if (!start && end) return `Until ${formatDate(end)}`;

  const [sy, sm, sd] = start!.split('-').map(Number);
  const [ey, em, ed] = end!.split('-').map(Number);
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${sy}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Inclusive day count, or null when either end is missing. */
export function dayCount(start: string | null, end: string | null): number | null {
  if (!start || !end || !isValidIsoDate(start) || !isValidIsoDate(end)) return null;
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

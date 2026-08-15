/**
 * Money helpers.
 *
 * Everything internal is an integer number of minor units. Conversion to a
 * decimal string happens once, at render time. Nothing in this file adds,
 * subtracts or compares floats.
 */

/** Currencies we support that do NOT use 2 decimal places. */
const MINOR_UNIT_EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  IDR: 0,
  ISK: 0,
  CLP: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
};

export const SUPPORTED_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'SGD',
  'AED',
  'THB',
] as const;

const SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'AED ',
  THB: '฿',
};

export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENTS[currency.toUpperCase()] ?? 2;
}

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

/**
 * Parses user input ("1,250.50", "₹1250", "  ") into minor units.
 * Returns null for empty/unparseable input so callers can store NULL rather
 * than silently recording a zero.
 */
export function parseMoney(input: string, currency: string): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  const factor = 10 ** minorUnitExponent(currency);
  // Round through a string to dodge the classic 1.005 * 100 = 100.49999 case.
  return Math.round(Number((value * factor).toFixed(4)));
}

/** Minor units -> plain decimal string, no symbol. Used to seed text inputs. */
export function toDecimalString(minor: number | null, currency: string): string {
  if (minor === null) return '';
  const exp = minorUnitExponent(currency);
  if (exp === 0) return String(minor);

  const negative = minor < 0;
  const abs = Math.abs(minor);
  const factor = 10 ** exp;
  const whole = Math.floor(abs / factor);
  const frac = String(abs % factor).padStart(exp, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/**
 * Display formatting: "₹1,250.50".
 *
 * `compact` drops the fractional part, which is what the dashboards and budget
 * bars want — nobody reading "₹12,000 of ₹15,000" cares about the paise.
 */
export function formatMoney(
  minor: number | null,
  currency: string,
  options: { compact?: boolean } = {},
): string {
  if (minor === null) return '—';

  const exp = minorUnitExponent(currency);
  const symbol = currencySymbol(currency);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const factor = 10 ** exp;

  const whole = Math.floor(abs / factor);
  const grouped = groupDigits(whole, currency);

  if (options.compact || exp === 0) {
    return `${negative ? '-' : ''}${symbol}${grouped}`;
  }
  const frac = String(abs % factor).padStart(exp, '0');
  return `${negative ? '-' : ''}${symbol}${grouped}.${frac}`;
}

/** INR groups as 12,34,567 (lakh/crore); everything else as 1,234,567. */
function groupDigits(value: number, currency: string): string {
  const digits = String(value);
  if (currency.toUpperCase() !== 'INR') {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

/** Sums minor-unit values, treating null as "not counted". */
export function sumMinor(values: (number | null | undefined)[]): number {
  let total = 0;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

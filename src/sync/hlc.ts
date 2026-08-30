/**
 * A hybrid logical clock.
 *
 * Sync has to decide which of two edits to a row is newer, and the obvious
 * answer — compare the phones' clocks — is wrong often enough to lose people's
 * data. Two devices routinely disagree by seconds, sometimes by hours after a
 * timezone change or a flat battery, and a phone whose clock runs slow would
 * quietly lose every edit it ever made.
 *
 * An HLC keeps the useful half of a wall clock (timestamps roughly match real
 * time, so they are debuggable and sort sensibly) while guaranteeing the part a
 * wall clock cannot: a timestamp is always greater than any timestamp the
 * device has already seen. Merging is then a string comparison, and it is
 * deterministic — both devices reach the same answer without talking.
 *
 * Format is a sortable string: `<millis>:<counter>:<node>`, zero-padded so
 * lexicographic order is chronological order.
 */

export interface Hlc {
  /** Physical milliseconds since the epoch. */
  millis: number;
  /** Breaks ties inside the same millisecond, and carries causality forward. */
  counter: number;
  /** This device. Makes two otherwise identical stamps orderable. */
  node: string;
}

/** Wide enough for timestamps until the year 5138. */
const MILLIS_DIGITS = 15;
const COUNTER_DIGITS = 5;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;

/**
 * How far ahead of our own clock another device's stamp may be before we
 * refuse it. A phone that thinks it is 2049 would otherwise poison the clock
 * for every device that syncs with it, permanently.
 */
export const MAX_DRIFT_MS = 24 * 60 * 60 * 1000;

export function encode(hlc: Hlc): string {
  return [
    String(hlc.millis).padStart(MILLIS_DIGITS, '0'),
    String(hlc.counter).padStart(COUNTER_DIGITS, '0'),
    hlc.node,
  ].join(':');
}

export function decode(stamp: string): Hlc | null {
  const parts = stamp.split(':');
  if (parts.length !== 3) return null;
  const millis = Number(parts[0]);
  const counter = Number(parts[1]);
  if (!Number.isInteger(millis) || !Number.isInteger(counter)) return null;
  if (millis < 0 || counter < 0 || !parts[2]) return null;
  return { millis, counter, node: parts[2] };
}

/**
 * The next stamp for a local edit.
 *
 * If the wall clock has moved on, use it and reset the counter. If it has not —
 * two edits in the same millisecond, or a clock that has gone backwards —
 * increment the counter instead, so the stamp still rises.
 */
export function tick(last: Hlc, now: number, node: string): Hlc {
  if (now > last.millis) return { millis: now, counter: 0, node };
  return { millis: last.millis, counter: last.counter + 1, node };
}

export type ReceiveResult =
  | { ok: true; hlc: Hlc }
  /** The remote stamp is implausible; ours is left untouched. */
  | { ok: false; reason: 'drift' | 'overflow' };

/**
 * Advances our clock past a stamp seen from another device.
 *
 * This is what makes the ordering causal rather than merely chronological:
 * after receiving an edit, everything we write is ordered after it, whatever
 * our own clock says.
 */
export function receive(local: Hlc, remote: Hlc, now: number, node: string): ReceiveResult {
  if (remote.millis - now > MAX_DRIFT_MS) return { ok: false, reason: 'drift' };

  const millis = Math.max(now, local.millis, remote.millis);

  let counter: number;
  if (millis === local.millis && millis === remote.millis) {
    counter = Math.max(local.counter, remote.counter) + 1;
  } else if (millis === local.millis) {
    counter = local.counter + 1;
  } else if (millis === remote.millis) {
    counter = remote.counter + 1;
  } else {
    counter = 0;
  }

  if (counter > MAX_COUNTER) return { ok: false, reason: 'overflow' };
  return { ok: true, hlc: { millis, counter, node } };
}

/** Negative when `a` happened first. Total, so two devices always agree. */
export function compare(a: Hlc, b: Hlc): number {
  if (a.millis !== b.millis) return a.millis - b.millis;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.node < b.node ? -1 : a.node > b.node ? 1 : 0;
}

/** The clock a device starts life with. */
export function zero(node: string): Hlc {
  return { millis: 0, counter: 0, node };
}

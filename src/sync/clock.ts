import * as Crypto from 'expo-crypto';

import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settings';
import { decode, encode, receive, tick, zero, type Hlc } from './hlc';

/**
 * This device's identity and clock.
 *
 * The node id is generated once and kept for the life of the install. It is
 * random and means nothing — it exists to break ties between two devices, not
 * to identify anybody, and it never leaves the device except inside stamps on
 * rows the user has chosen to sync.
 */

const NODE_KEY = 'sync.node';
const CLOCK_KEY = 'sync.clock';

let node: string | null = null;
let current: Hlc | null = null;

/** Short enough to keep stamps readable, wide enough not to collide. */
function newNode(): string {
  return Crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export async function nodeId(): Promise<string> {
  if (node) return node;
  const stored = await settingsRepo.readAll();
  const existing = typeof stored[NODE_KEY] === 'string' ? (stored[NODE_KEY] as string) : null;
  node = existing ?? newNode();
  if (!existing) await settingsRepo.write(NODE_KEY, node);
  return node;
}

async function load(): Promise<Hlc> {
  if (current) return current;
  const id = await nodeId();
  const stored = await settingsRepo.readAll();
  const raw = typeof stored[CLOCK_KEY] === 'string' ? (stored[CLOCK_KEY] as string) : null;
  current = (raw ? decode(raw) : null) ?? zero(id);
  return current;
}

async function save(hlc: Hlc): Promise<void> {
  current = hlc;
  await settingsRepo.write(CLOCK_KEY, encode(hlc));
}

/**
 * The stamp for a write happening now.
 *
 * Persisted every time, because a clock that resets on relaunch would let a
 * device re-issue stamps it has already used and quietly lose the edits it
 * made before the restart.
 */
export async function stamp(now = Date.now()): Promise<string> {
  const id = await nodeId();
  const next = tick(await load(), now, id);
  await save(next);
  return encode(next);
}

/**
 * Advances the clock past everything in an incoming set of stamps, so that
 * whatever this device writes next sorts after what it has just learned.
 *
 * Returns how many stamps were rejected as implausible — a device whose clock
 * is a year out is worth telling someone about rather than silently obeying.
 */
export async function observe(stamps: string[], now = Date.now()): Promise<number> {
  const id = await nodeId();
  let hlc = await load();
  let rejected = 0;

  for (const raw of stamps) {
    const remote = decode(raw);
    if (!remote) continue;
    const result = receive(hlc, remote, now, id);
    if (result.ok) hlc = result.hlc;
    else rejected++;
  }

  await save(hlc);
  return rejected;
}

/** Tables whose rows travel between devices, in foreign-key order. */
export const SYNCED_TABLES = [
  'trips',
  'stops',
  'activities',
  'food_plans',
  'expenses',
  'bookings',
  'packing_items',
  'journal_entries',
  'journal_photos',
] as const;

/**
 * Gives every row a stamp it can be merged on.
 *
 * Runs once after the migration that added the column, and again for anything
 * that slips through. A row with no stamp — or with the ISO string
 * `journal_entries` used to keep there — would sort against real stamps
 * arbitrarily, so it is given one now rather than at the moment it matters.
 */
export async function backfillStamps(): Promise<number> {
  const db = await getDb();
  let stamped = 0;

  for (const table of SYNCED_TABLES) {
    const rows = await db.getAllAsync<{ id: string; updated_at: string }>(
      `SELECT id, updated_at FROM ${table}`,
    );
    for (const row of rows) {
      if (decode(row.updated_at)) continue;
      await db.runAsync(`UPDATE ${table} SET updated_at = ? WHERE id = ?`, await stamp(), row.id);
      stamped++;
    }
  }

  return stamped;
}

/** Test seam: forgets the cached node and clock. */
export function resetForTesting(): void {
  node = null;
  current = null;
}

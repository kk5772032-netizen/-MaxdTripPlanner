/**
 * Merging two copies of the same data.
 *
 * This is the part of sync that either keeps people's edits or loses them, and
 * it is written as a pure function over plain objects so that every awkward
 * case can be argued with in a test rather than discovered on a phone.
 *
 * The rules, in the order they matter:
 *
 *   1. Rows are matched by id. Ids are generated locally and are unique, so a
 *      row edited on two devices is one row, and two rows created separately
 *      are two rows — there is no guessing.
 *   2. The later stamp wins, compared as an HLC string rather than a wall
 *      clock. See `hlc.ts` for why that distinction matters.
 *   3. A deletion is a row like any other, with its own stamp. Without that,
 *      deleting on one device and syncing would silently resurrect the row from
 *      the other — the most common way naive sync loses people's trust.
 *   4. Ties go to the higher device id. Arbitrary, but identical on both sides,
 *      which is what stops two devices disagreeing forever.
 *
 * Last-write-wins is per row, not per field. Merging fields would keep more
 * edits in theory and produce records nobody wrote in practice: half of one
 * person's booking and half of another's is worse than either of them.
 */

export interface SyncRow {
  id: string;
  /** Encoded HLC. See `hlc.ts`. */
  updatedAt: string;
  [key: string]: unknown;
}

/** A row that was deleted, and when. */
export interface Tombstone {
  id: string;
  table: string;
  deletedAt: string;
}

export interface Snapshot {
  /** Table name to rows. */
  tables: Record<string, SyncRow[]>;
  tombstones: Tombstone[];
}

export interface MergeStats {
  /** Rows taken from the incoming side because they were newer. */
  incoming: number;
  /** Rows kept from ours because ours were newer. */
  kept: number;
  /** Rows added that we had never seen. */
  added: number;
  /** Rows dropped because the other side had deleted them. */
  deleted: number;
}

export interface MergeResult {
  merged: Snapshot;
  stats: MergeStats;
}

function tombstoneKey(table: string, id: string): string {
  return `${table} ${id}`;
}

/**
 * Every deletion either side knows about, keeping the earliest stamp for each.
 *
 * Earliest, not latest: a tombstone answers "was this row deleted after it was
 * last edited?", and holding a stamp later than the delete actually happened
 * would let it beat an edit it predates.
 */
function mergeTombstones(a: Tombstone[], b: Tombstone[]): Map<string, Tombstone> {
  const out = new Map<string, Tombstone>();
  for (const t of [...a, ...b]) {
    const key = tombstoneKey(t.table, t.id);
    const seen = out.get(key);
    if (!seen || t.deletedAt < seen.deletedAt) out.set(key, t);
  }
  return out;
}

/**
 * Merges `incoming` into `ours`.
 *
 * Symmetric: merging A into B gives the same result as B into A, which is what
 * lets two devices converge without a server deciding who is authoritative.
 */
export function merge(ours: Snapshot, incoming: Snapshot): MergeResult {
  const tombstones = mergeTombstones(ours.tombstones, incoming.tombstones);
  const stats: MergeStats = { incoming: 0, kept: 0, added: 0, deleted: 0 };
  const tables: Record<string, SyncRow[]> = {};

  const names = new Set([...Object.keys(ours.tables), ...Object.keys(incoming.tables)]);

  for (const name of names) {
    const byId = new Map<string, SyncRow>();

    for (const row of ours.tables[name] ?? []) byId.set(row.id, row);

    for (const row of incoming.tables[name] ?? []) {
      const mine = byId.get(row.id);
      if (!mine) {
        byId.set(row.id, row);
        stats.added++;
      } else if (row.updatedAt > mine.updatedAt) {
        byId.set(row.id, row);
        stats.incoming++;
      } else if (row.updatedAt < mine.updatedAt) {
        stats.kept++;
      }
      // Equal stamps mean the same write reached us twice. Nothing to do: the
      // HLC's node segment makes a genuine tie between two devices impossible.
    }

    const rows: SyncRow[] = [];
    for (const row of byId.values()) {
      const grave = tombstones.get(tombstoneKey(name, row.id));
      // The row survives only if it was edited after it was deleted, which is
      // how an edit on one device beats an earlier delete on another.
      if (grave && grave.deletedAt > row.updatedAt) {
        stats.deleted++;
        continue;
      }
      rows.push(row);
    }

    tables[name] = rows.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  }

  return {
    merged: {
      tables,
      tombstones: [...tombstones.values()].sort((x, y) =>
        tombstoneKey(x.table, x.id) < tombstoneKey(y.table, y.id) ? -1 : 1,
      ),
    },
    stats,
  };
}

/**
 * Tombstones nobody needs any more.
 *
 * They cannot be dropped eagerly: a device that has been offline for a week
 * still needs to hear about a delete from six days ago, or it will bring the
 * row back. Past the point where no device could still be unaware, they are
 * dead weight in every future sync.
 */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function pruneTombstones(
  tombstones: Tombstone[],
  now: number,
  ttlMs = TOMBSTONE_TTL_MS,
): Tombstone[] {
  const cutoff = now - ttlMs;
  return tombstones.filter((t) => {
    const millis = Number(t.deletedAt.split(':')[0]);
    // A stamp we cannot read is kept: dropping a delete is worse than carrying
    // one row of dead weight.
    return !Number.isFinite(millis) || millis >= cutoff;
  });
}

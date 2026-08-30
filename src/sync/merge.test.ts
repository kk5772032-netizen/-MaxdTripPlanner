import { encode } from './hlc';
import {
  TOMBSTONE_TTL_MS,
  merge,
  pruneTombstones,
  type Snapshot,
  type SyncRow,
  type Tombstone,
} from './merge';

const A = 'device-a';
const B = 'device-b';

/** A stamp at `millis` from `node`, so tests read as a timeline. */
const at = (millis: number, node = A, counter = 0) => encode({ millis, counter, node });

const row = (id: string, updatedAt: string, extra: Record<string, unknown> = {}): SyncRow => ({
  id,
  updatedAt,
  ...extra,
});

const snapshot = (
  tables: Record<string, SyncRow[]>,
  tombstones: Tombstone[] = [],
): Snapshot => ({ tables, tombstones });

const names = (s: Snapshot, table: string) => s.tables[table].map((r) => r.name);

describe('merge', () => {
  it('keeps rows only one side has ever seen', () => {
    const ours = snapshot({ trips: [row('t1', at(100), { name: 'Delhi' })] });
    const theirs = snapshot({ trips: [row('t2', at(100, B), { name: 'Goa' })] });

    const { merged, stats } = merge(ours, theirs);
    expect(names(merged, 'trips')).toEqual(['Delhi', 'Goa']);
    expect(stats.added).toBe(1);
  });

  it('takes the later edit when the same row changed on both', () => {
    const ours = snapshot({ trips: [row('t1', at(100), { name: 'Delhi' })] });
    const theirs = snapshot({ trips: [row('t1', at(200, B), { name: 'Delhi trip' })] });

    const { merged, stats } = merge(ours, theirs);
    expect(names(merged, 'trips')).toEqual(['Delhi trip']);
    expect(stats.incoming).toBe(1);
    expect(stats.kept).toBe(0);
  });

  it('keeps ours when ours is the later edit', () => {
    const ours = snapshot({ trips: [row('t1', at(300), { name: 'Mine' })] });
    const theirs = snapshot({ trips: [row('t1', at(200, B), { name: 'Theirs' })] });

    const { merged, stats } = merge(ours, theirs);
    expect(names(merged, 'trips')).toEqual(['Mine']);
    expect(stats.kept).toBe(1);
  });

  it('reaches the same answer whichever way round it is merged', () => {
    // Without this two devices disagree forever, each certain it is right.
    const a = snapshot(
      { trips: [row('t1', at(100), { name: 'A' }), row('t2', at(400), { name: 'only-a' })] },
      [{ table: 'trips', id: 't3', deletedAt: at(250) }],
    );
    const b = snapshot(
      { trips: [row('t1', at(300, B), { name: 'B' }), row('t3', at(100, B), { name: 'doomed' })] },
      [],
    );

    expect(merge(a, b).merged).toEqual(merge(b, a).merged);
  });

  it('is unchanged by merging a snapshot with itself', () => {
    const s = snapshot({ trips: [row('t1', at(100), { name: 'Delhi' })] });
    expect(merge(s, s).merged).toEqual(s);
  });

  it('does not resurrect a row the other device deleted', () => {
    // The single most common way naive sync loses trust: you delete something,
    // sync, and it comes back.
    const ours = snapshot({ trips: [row('t1', at(100), { name: 'Delhi' })] });
    const theirs = snapshot({ trips: [] }, [{ table: 'trips', id: 't1', deletedAt: at(200, B) }]);

    const { merged, stats } = merge(ours, theirs);
    expect(merged.tables.trips).toEqual([]);
    expect(stats.deleted).toBe(1);
  });

  it('lets a later edit beat an earlier delete', () => {
    // You delete it on the tablet in the morning, edit it on the phone in the
    // afternoon: the edit is the more recent intention and it wins.
    const ours = snapshot({ trips: [row('t1', at(500), { name: 'Edited after' })] });
    const theirs = snapshot({ trips: [] }, [{ table: 'trips', id: 't1', deletedAt: at(200, B) }]);

    expect(names(merge(ours, theirs).merged, 'trips')).toEqual(['Edited after']);
  });

  it('keeps the earliest stamp for a deletion seen twice', () => {
    // Holding a later stamp than the delete really happened would let it beat
    // an edit it actually predates.
    const ours = snapshot({ trips: [] }, [{ table: 'trips', id: 't1', deletedAt: at(500) }]);
    const theirs = snapshot({ trips: [] }, [{ table: 'trips', id: 't1', deletedAt: at(200, B) }]);

    expect(merge(ours, theirs).merged.tombstones[0].deletedAt).toBe(at(200, B));
  });

  it('does not confuse the same id in two different tables', () => {
    const ours = snapshot({
      trips: [row('x', at(100), { name: 'trip' })],
      stops: [row('x', at(100), { name: 'stop' })],
    });
    const theirs = snapshot({ trips: [], stops: [] }, [
      { table: 'trips', id: 'x', deletedAt: at(200, B) },
    ]);

    const { merged } = merge(ours, theirs);
    expect(merged.tables.trips).toEqual([]);
    expect(names(merged, 'stops')).toEqual(['stop']);
  });

  it('carries a table the other side has never heard of', () => {
    // An older build has no packing list. Merging with it must not delete one.
    const ours = snapshot({ trips: [], packing_items: [row('p1', at(100), { name: 'Socks' })] });
    const theirs = snapshot({ trips: [] });

    expect(names(merge(ours, theirs).merged, 'packing_items')).toEqual(['Socks']);
    expect(names(merge(theirs, ours).merged, 'packing_items')).toEqual(['Socks']);
  });

  it('settles a same-millisecond clash the same way on both devices', () => {
    // Two phones, identical clocks, one row. The node segment decides, and it
    // decides identically wherever the merge runs.
    const ours = snapshot({ trips: [row('t1', at(100, A), { name: 'from A' })] });
    const theirs = snapshot({ trips: [row('t1', at(100, B), { name: 'from B' })] });

    expect(names(merge(ours, theirs).merged, 'trips')).toEqual(['from B']);
    expect(names(merge(theirs, ours).merged, 'trips')).toEqual(['from B']);
  });

  it('survives three-way sync through a middle device', () => {
    const a = snapshot({ trips: [row('t1', at(100), { name: 'A' })] });
    const b = snapshot({ trips: [row('t2', at(150, B), { name: 'B' })] });
    const c = snapshot({ trips: [row('t1', at(300, 'device-c'), { name: 'C wins' })] });

    const viaB = merge(merge(a, b).merged, c).merged;
    const viaC = merge(merge(a, c).merged, b).merged;
    expect(viaB).toEqual(viaC);
    expect(names(viaB, 'trips')).toEqual(['C wins', 'B']);
  });
});

describe('pruneTombstones', () => {
  const now = 1_000_000_000_000;

  it('keeps a deletion recent enough that a device might not know', () => {
    const recent: Tombstone = { table: 'trips', id: 't1', deletedAt: at(now - 1_000) };
    expect(pruneTombstones([recent], now)).toEqual([recent]);
  });

  it('drops one nobody can still be unaware of', () => {
    const old: Tombstone = { table: 'trips', id: 't1', deletedAt: at(now - TOMBSTONE_TTL_MS - 1) };
    expect(pruneTombstones([old], now)).toEqual([]);
  });

  it('keeps a stamp it cannot read rather than dropping a delete', () => {
    const broken: Tombstone = { table: 'trips', id: 't1', deletedAt: 'nonsense' };
    expect(pruneTombstones([broken], now)).toEqual([broken]);
  });
});

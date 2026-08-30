import { getDb, openTestDb, setDbForTesting } from '../db/client';
import * as tripsRepo from '../db/repositories/trips';
import { decode } from './hlc';
import { backfillStamps, nodeId, observe, resetForTesting, stamp } from './clock';

describe('this device\'s clock', () => {
  beforeEach(async () => {
    setDbForTesting(await openTestDb());
    resetForTesting();
  });

  afterEach(() => {
    setDbForTesting(null);
    resetForTesting();
  });

  it('settles on one node id and keeps it', async () => {
    const first = await nodeId();
    resetForTesting();
    // A fresh process reads it back rather than minting a second identity.
    expect(await nodeId()).toBe(first);
  });

  it('issues stamps that always rise', async () => {
    const stamps = [await stamp(1_000), await stamp(1_000), await stamp(2_000)];
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(3);
  });

  it('keeps rising across a restart', async () => {
    // A clock that reset on relaunch would re-issue stamps it had already
    // used, and quietly lose every edit made before the restart.
    const before = await stamp(5_000);
    resetForTesting();
    const after = await stamp(5_000);
    expect(after > before).toBe(true);
  });

  it('still rises when the phone clock goes backwards', async () => {
    const before = await stamp(10_000);
    const after = await stamp(1_000);
    expect(after > before).toBe(true);
  });

  it('moves past stamps seen from another device', async () => {
    const remote = '000000000009999:00000:other';
    await observe([remote], 1_000);
    expect(await stamp(1_000) > remote).toBe(true);
  });

  it('reports a device whose clock is wildly out rather than obeying it', async () => {
    const absurd = '000009999999999:00000:other';
    expect(await observe([absurd], 1_000)).toBe(1);
    // And our own clock is untouched by it.
    const next = decode(await stamp(1_000))!;
    expect(next.millis).toBeLessThan(9_999_999_999);
  });

  it('ignores anything that is not a stamp at all', async () => {
    expect(await observe(['', 'nonsense', '1:2'], 1_000)).toBe(0);
  });
});

describe('backfillStamps', () => {
  beforeEach(async () => {
    setDbForTesting(await openTestDb());
    resetForTesting();
  });

  afterEach(() => {
    setDbForTesting(null);
    resetForTesting();
  });

  it('gives an unstamped row something to merge on', async () => {
    const trip = await tripsRepo.createTrip({
      name: 'Delhi', startDate: null, endDate: null, currency: 'INR', totalBudgetMinor: null,
    });
    await (await getDb()).runAsync(`UPDATE trips SET updated_at = '' WHERE id = ?`, trip.id);

    expect(await backfillStamps()).toBe(1);

    const row = await (await getDb()).getFirstAsync<{ updated_at: string }>(
      `SELECT updated_at FROM trips WHERE id = ?`,
      trip.id,
    );
    expect(decode(row!.updated_at)).not.toBeNull();
  });

  it('leaves a row that already has one alone', async () => {
    await tripsRepo.createTrip({
      name: 'Delhi', startDate: null, endDate: null, currency: 'INR', totalBudgetMinor: null,
    });
    await backfillStamps();
    expect(await backfillStamps()).toBe(0);
  });

  it('replaces the ISO instant journal entries used to keep', async () => {
    // That column was reused rather than doubled; an ISO string sorts against
    // real stamps arbitrarily, so it has to go.
    const trip = await tripsRepo.createTrip({
      name: 'Delhi', startDate: null, endDate: null, currency: 'INR', totalBudgetMinor: null,
    });
    await (await getDb()).runAsync(
      `INSERT INTO journal_entries (id, trip_id, day_date, note, updated_at)
       VALUES ('j1', ?, '2026-11-09', 'Rained', '2026-08-29T10:00:00.000Z')`,
      trip.id,
    );

    expect(await backfillStamps()).toBeGreaterThan(0);

    const row = await (await getDb()).getFirstAsync<{ updated_at: string }>(
      `SELECT updated_at FROM journal_entries WHERE id = 'j1'`,
    );
    expect(decode(row!.updated_at)).not.toBeNull();
  });
});

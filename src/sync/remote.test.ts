import { buildBackup } from '../backup/backup';
import { openTestDb, setDbForTesting } from '../db/client';
import * as settingsRepo from '../db/repositories/settings';
import * as stopsRepo from '../db/repositories/stops';
import * as tripsRepo from '../db/repositories/trips';
import { resetForTesting } from './clock';
import {
  formatSyncCode,
  newSyncCode,
  parseSyncCode,
  readLastSync,
  readSyncSettings,
  syncNow,
  writeSyncSettings,
} from './remote';

/**
 * The sync code is the whole security model, so it gets tested like one, and
 * `syncNow` is tested against a fake server that is allowed to misbehave —
 * being offline, being slow, having nothing yet, refusing the upload. Those
 * are the ordinary states of a phone on a trip, not the exceptional ones.
 */

/** Copied from the worker. If these ever disagree, every code is rejected. */
const WORKER_PATTERN = /^[0-9a-hjkmnp-tv-z]{26}$/;

describe('sync codes', () => {
  it('matches what the server will accept', () => {
    for (let i = 0; i < 200; i++) {
      expect(newSyncCode()).toMatch(WORKER_PATTERN);
    }
  });

  it('leaves out the letters people misread', () => {
    // i/l against 1, o against 0, and u because it turns codes into words.
    const codes = Array.from({ length: 200 }, newSyncCode).join('');
    expect(codes).not.toMatch(/[ilou]/);
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 500 }, newSyncCode));
    expect(codes.size).toBe(500);
  });

  it('uses the whole alphabet, so the length is really the entropy', () => {
    // A generator that only ever emitted half its symbols would still look
    // fine above while being far easier to guess than 26 characters suggests.
    const seen = new Set(Array.from({ length: 400 }, newSyncCode).join(''));
    expect(seen.size).toBe(32);
  });

  it('groups a code for reading aloud without changing it', () => {
    const code = newSyncCode();
    expect(formatSyncCode(code)).toMatch(/^(.{5}-){5}.$/);
    expect(parseSyncCode(formatSyncCode(code))).toBe(code);
  });

  it('accepts a code typed the way people type it', () => {
    const code = newSyncCode();
    for (const typed of [
      code.toUpperCase(),
      formatSyncCode(code).toUpperCase(),
      formatSyncCode(code).replace(/-/g, ' '),
      `  ${code}  `,
    ]) {
      expect(parseSyncCode(typed)).toBe(code);
    }
  });

  it('refuses anything that is not a code', () => {
    const code = newSyncCode();
    for (const bad of ['', 'hello', code.slice(1), `${code}x`, code.replace(/^./, 'i')]) {
      expect(parseSyncCode(bad)).toBeNull();
    }
  });
});

describe('sync settings', () => {
  beforeEach(async () => {
    setDbForTesting(await openTestDb());
    resetForTesting();
  });
  afterEach(() => {
    setDbForTesting(null);
    resetForTesting();
  });

  it('starts with nothing set up', async () => {
    expect(await readSyncSettings()).toEqual({ url: null, code: null });
  });

  it('remembers a server and a code', async () => {
    const code = newSyncCode();
    await writeSyncSettings({ url: 'https://sync.example.com', code });
    expect(await readSyncSettings()).toEqual({ url: 'https://sync.example.com', code });
  });

  it('drops a trailing slash so the endpoint is never doubled', async () => {
    await writeSyncSettings({ url: 'https://sync.example.com///', code: null });
    expect((await readSyncSettings()).url).toBe('https://sync.example.com');
  });

  it('forgets the server when sync is turned off', async () => {
    await writeSyncSettings({ url: 'https://sync.example.com', code: newSyncCode() });
    await writeSyncSettings({ url: null, code: null });
    expect(await readSyncSettings()).toEqual({ url: null, code: null });
    expect(await readLastSync()).toBeNull();
    // And leaves no debris behind in settings for a later read to trip over.
    const stored = await settingsRepo.readAll();
    expect(Object.keys(stored).some((k) => k.startsWith('sync.'))).toBe(false);
  });
});

describe('syncNow', () => {
  const URL_BASE = 'https://sync.example.com';
  let fetchMock: jest.Mock;

  /** A device: its own database, its own clock identity, sync configured. */
  async function newDevice(code: string): Promise<void> {
    setDbForTesting(await openTestDb());
    resetForTesting();
    await writeSyncSettings({ url: URL_BASE, code });
  }

  const newTrip = (name: string) =>
    tripsRepo.createTrip({
      name,
      startDate: '2026-11-09',
      endDate: '2026-11-11',
      currency: 'INR',
      totalBudgetMinor: null,
    });

  const newStop = (tripId: string, name: string) =>
    stopsRepo.createStop({
      tripId, name, address: null, googlePlaceId: null, lat: null, lng: null,
      rating: null, photoRef: null, plannedBudgetMinor: null, notes: null,
    });

  /**
   * The worker, in memory: one blob under one key, 404 until something is put
   * there. Everything the real server does that matters to the client.
   */
  function fakeServer() {
    const store = new Map<string, string>();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const key = String(url);
      if (init?.method === 'PUT') {
        store.set(key, String(init.body));
        return new Response('{"ok":true}', { status: 200 });
      }
      const body = store.get(key);
      return body
        ? new Response(body, { status: 200 })
        : new Response('{"error":"nothing yet"}', { status: 404 });
    });
    return store;
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    setDbForTesting(null);
    resetForTesting();
    jest.restoreAllMocks();
  });

  it('says so plainly when sync has not been set up', async () => {
    setDbForTesting(await openTestDb());
    resetForTesting();
    const outcome = await syncNow();
    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('not set up') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an empty server as the first device, not a failure', async () => {
    const store = fakeServer();
    const code = newSyncCode();
    await newDevice(code);
    await newTrip('Delhi');

    const outcome = await syncNow();
    expect(outcome).toEqual({ ok: true, pulled: 0, pushed: true });
    expect(store.get(`${URL_BASE}/v1/trips/${code}`)).toContain('Delhi');
  });

  it('carries a trip from one device to the other', async () => {
    fakeServer();
    const code = newSyncCode();

    await newDevice(code);
    const trip = await newTrip('Delhi');
    await newStop(trip.id, 'Red Fort');
    expect((await syncNow()).ok).toBe(true);

    await newDevice(code);
    expect((await tripsRepo.listTrips())).toHaveLength(0);
    const outcome = await syncNow();

    expect(outcome.ok).toBe(true);
    expect((await tripsRepo.listTrips()).map((t) => t.name)).toEqual(['Delhi']);
    expect(await stopsRepo.listStops(trip.id)).toHaveLength(1);
  });

  it('leaves both devices holding everything, whoever synced first', async () => {
    fakeServer();
    const code = newSyncCode();

    await newDevice(code);
    const phoneTrip = await newTrip('Delhi');
    await syncNow();

    await newDevice(code);
    const tabletTrip = await newTrip('Goa');
    await syncNow();

    // The phone comes back and picks up what the tablet added.
    await writeSyncSettings({ url: URL_BASE, code });
    await syncNow();

    expect((await tripsRepo.listTrips()).map((t) => t.name).sort()).toEqual(['Delhi', 'Goa']);
    expect([phoneTrip.id, tabletTrip.id]).toHaveLength(2);
  });

  it('changes nothing on a second round with nothing new', async () => {
    fakeServer();
    const code = newSyncCode();
    await newDevice(code);
    await newTrip('Delhi');

    await syncNow();
    const outcome = await syncNow();

    expect(outcome).toEqual({ ok: true, pulled: 0, pushed: true });
    expect(await tripsRepo.listTrips()).toHaveLength(1);
  });

  it('does not push over a pull that failed', async () => {
    // The one that matters. A phone whose fetch timed out holds a stale copy;
    // uploading it would erase whatever the other device had just added.
    const store = fakeServer();
    const code = newSyncCode();
    const key = `${URL_BASE}/v1/trips/${code}`;

    await newDevice(code);
    await newTrip('Delhi');
    await syncNow();
    const stored = store.get(key);

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') throw new Error('should never get here');
      throw new TypeError('Network request failed');
    });

    await newDevice(code);
    await newTrip('Only on this phone');
    const outcome = await syncNow();

    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining("Couldn't reach") });
    expect(store.get(key)).toBe(stored);
  });

  it('reports what the server itself said rather than a guess', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"nope"}', { status: 500 }));
    await newDevice(newSyncCode());
    const outcome = await syncNow();
    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('500') });
  });

  it('keeps what it pulled even when the upload fails', async () => {
    const code = newSyncCode();

    // One device gets its data onto the server.
    fakeServer();
    await newDevice(code);
    await newTrip('Delhi');
    await syncNow();
    const snapshot = JSON.stringify(await buildBackup());

    // The second device can read, but the write is refused.
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Response('{"error":"too big"}', { status: 413 })
        : new Response(snapshot, { status: 200 }),
    );

    await newDevice(code);
    const outcome = await syncNow();

    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('413') });
    // The merge already happened, so the device is better off than before.
    expect((await tripsRepo.listTrips()).map((t) => t.name)).toEqual(['Delhi']);
  });

  it('refuses a snapshot that is not a backup at all', async () => {
    fetchMock.mockResolvedValue(new Response('{"hello":"world"}', { status: 200 }));
    await newDevice(newSyncCode());
    await newTrip('Delhi');
    const outcome = await syncNow();
    expect(outcome.ok).toBe(false);
    // And the local trip survives being handed nonsense.
    expect(await tripsRepo.listTrips()).toHaveLength(1);
  });

  it('records when it last succeeded, and only then', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"nope"}', { status: 500 }));
    await newDevice(newSyncCode());
    await syncNow();
    expect(await readLastSync()).toBeNull();

    fakeServer();
    await syncNow();
    expect(await readLastSync()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('asks the server for the code it was given', async () => {
    fakeServer();
    const code = newSyncCode();
    await newDevice(code);
    await syncNow();
    expect(fetchMock.mock.calls[0][0]).toBe(`${URL_BASE}/v1/trips/${code}`);
  });
});

import * as Crypto from 'expo-crypto';

import { buildBackup, mergeBackup } from '../backup/backup';
import { parseBackup, type Backup } from '../backup/format';
import * as settingsRepo from '../db/repositories/settings';

/**
 * Syncing through a server that knows nothing.
 *
 * The device does the merging, so this is push-pull and nothing more: fetch
 * what is stored, merge it into what is here, send the result back. Two devices
 * sharing a code converge on the same data; so do two people, which is why
 * this is collaboration as well as sync.
 *
 * All of it is optional. With no server configured the app behaves exactly as
 * it did before — a backup file passed by hand is still a complete answer, and
 * one that works with no account and no network at all.
 */

const URL_KEY = 'sync.url';
const CODE_KEY = 'sync.code';
const LAST_KEY = 'sync.lastAt';

/**
 * Crockford's base32 without the letters that get misread. Codes are shown to
 * people and occasionally read aloud, and `l` against `1` is a support ticket.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const CODE_LENGTH = 26;

/** About 130 bits. The code is the only credential, so it has to carry that. */
export function newSyncCode(): string {
  const bytes = Crypto.getRandomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Grouped for reading aloud: `k3f9x-2m1pq-...`. Never stored this way. */
export function formatSyncCode(code: string): string {
  return (code.match(/.{1,5}/g) ?? []).join('-');
}

export function parseSyncCode(input: string): string | null {
  const cleaned = input.toLowerCase().replace(/[^0-9a-z]/g, '');
  return cleaned.length === CODE_LENGTH && [...cleaned].every((c) => ALPHABET.includes(c))
    ? cleaned
    : null;
}

export interface SyncSettings {
  url: string | null;
  code: string | null;
}

export async function readSyncSettings(): Promise<SyncSettings> {
  const stored = await settingsRepo.readAll();
  return {
    url: typeof stored[URL_KEY] === 'string' ? (stored[URL_KEY] as string) : null,
    code: typeof stored[CODE_KEY] === 'string' ? (stored[CODE_KEY] as string) : null,
  };
}

export async function writeSyncSettings(settings: SyncSettings): Promise<void> {
  if (settings.url) await settingsRepo.write(URL_KEY, settings.url.replace(/\/+$/, ''));
  else await settingsRepo.remove(URL_KEY);

  if (settings.code) await settingsRepo.write(CODE_KEY, settings.code);
  else await settingsRepo.remove(CODE_KEY);

  // Turning sync off leaves nothing behind, including the claim that this
  // device was up to date at some point with a server it no longer knows.
  if (!settings.url && !settings.code) await settingsRepo.remove(LAST_KEY);
}

/**
 * When the last round finished, so the screen can say how current this device
 * is. Without it "Sync now" is a button you press hopefully.
 */
export async function readLastSync(): Promise<string | null> {
  const stored = await settingsRepo.readAll();
  return typeof stored[LAST_KEY] === 'string' ? (stored[LAST_KEY] as string) : null;
}

export type SyncOutcome =
  | { ok: true; pulled: number; pushed: boolean }
  | { ok: false; reason: string };

const TIMEOUT_MS = 20_000;

async function withTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One round: pull, merge, push.
 *
 * Pushing the merged result rather than only our own changes is what makes
 * this converge — after a successful round both sides hold the same set, and
 * the next device to sync sees everything.
 *
 * A failed pull stops the round. Pushing what we have over a fetch that might
 * simply have timed out is how a phone with a stale copy silently overwrites
 * whatever the other device did.
 */
export async function syncNow(): Promise<SyncOutcome> {
  const { url, code } = await readSyncSettings();
  if (!url || !code) return { ok: false, reason: 'Sync is not set up yet.' };

  const endpoint = `${url}/v1/trips/${code}`;

  let remote: Backup | null = null;
  try {
    const response = await withTimeout(endpoint, { method: 'GET' });
    if (response.status === 404) {
      // Nothing stored yet: this device is the first, and its own data is the
      // starting point rather than an error.
      remote = null;
    } else if (!response.ok) {
      return { ok: false, reason: `The sync server said ${response.status}.` };
    } else {
      const parsed = parseBackup(await response.text());
      if (!parsed.ok) return { ok: false, reason: parsed.reason };
      remote = parsed.backup;
    }
  } catch (e) {
    console.warn('[sync] pull failed', e);
    return { ok: false, reason: "Couldn't reach the sync server." };
  }

  let pulled = 0;
  if (remote) {
    const stats = await mergeBackup(remote);
    pulled = stats.added + stats.incoming + stats.deleted;
  }

  try {
    const merged = await buildBackup();
    const response = await withTimeout(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
    if (!response.ok) {
      // The merge already happened locally, so this device is not worse off —
      // it simply has not shared what it knows yet.
      return { ok: false, reason: `Pulled, but the server refused the upload (${response.status}).` };
    }
  } catch (e) {
    console.warn('[sync] push failed', e);
    return { ok: false, reason: 'Pulled, but could not upload.' };
  }

  await settingsRepo.write(LAST_KEY, new Date().toISOString());
  return { ok: true, pulled, pushed: true };
}

import * as Crypto from 'expo-crypto';

/**
 * Row ids. UUIDv4 via expo-crypto so ids stay unique if a sync layer is ever
 * bolted on (the README promises local-only for v1, but ids are cheap to get
 * right up front).
 */
export function newId(): string {
  return Crypto.randomUUID();
}

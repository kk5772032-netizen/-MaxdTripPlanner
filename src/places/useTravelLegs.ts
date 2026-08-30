import { useEffect, useState } from 'react';

import { hasApiKey } from '../api/places';
import { straightLineMetres, travelLeg, type Leg } from '../api/routes';
import { pairId, pairsForDay } from '../itinerary/travel';
import { useSettingsStore } from '../state/settingsStore';
import type { Stop } from '../types';

/**
 * Travel times for one day's stops.
 *
 * Two answers, and the second is the one most builds get: with a Places key
 * each consecutive pair gets a real driving or walking time, cached for thirty
 * days so a day reopened costs nothing. Without one — or with the setting off
 * — the straight-line distance is computed on the device from coordinates the
 * stops already carry. Less useful than "22 min drive" and considerably better
 * than a blank rail.
 */
export interface TravelInfo {
  legs: Map<string, Leg | null>;
  /** Straight-line metres per pair, always available when both ends are placed. */
  distances: Map<string, number>;
}

const EMPTY: TravelInfo = { legs: new Map(), distances: new Map() };

export function useTravelLegs(stops: Stop[]): TravelInfo {
  const enabled = useSettingsStore((s) => s.travelTimes) && hasApiKey();
  const [info, setInfo] = useState<TravelInfo>(EMPTY);

  // The pairs, as a string, so the effect re-runs when the day's shape changes
  // and not on every render that happens to produce an equal array.
  const pairs = pairsForDay(stops);
  const signature = pairs
    .map((p) => `${p.fromId}:${p.from.lat},${p.from.lng}>${p.toId}:${p.to.lat},${p.to.lng}`)
    .join('|');

  useEffect(() => {
    const distances = new Map<string, number>();
    for (const pair of pairs) {
      distances.set(pairId(pair.fromId, pair.toId), straightLineMetres(pair.from, pair.to));
    }

    if (!enabled || pairs.length === 0) {
      setInfo({ legs: new Map(), distances });
      return;
    }

    let live = true;
    const controller = new AbortController();
    setInfo((prev) => ({ legs: prev.legs, distances }));

    void (async () => {
      const legs = new Map<string, Leg | null>();
      for (const pair of pairs) {
        if (!live) return;
        try {
          legs.set(
            pairId(pair.fromId, pair.toId),
            await travelLeg(pair.from, pair.to, { signal: controller.signal }),
          );
        } catch {
          // One leg failing is not a reason to lose the others.
          legs.set(pairId(pair.fromId, pair.toId), null);
        }
        // Painted as they arrive, so a cached day appears at once and an
        // uncached one fills in rather than waiting for the slowest request.
        if (live) setInfo({ legs: new Map(legs), distances });
      }
    })();

    return () => {
      live = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);

  return info;
}

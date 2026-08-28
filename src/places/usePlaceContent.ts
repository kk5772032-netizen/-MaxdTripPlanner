import { useEffect, useState } from 'react';

import { PlacesError, hasApiKey, placeDetails } from '../api/places';
import type { PlaceDetails } from '../types';

/**
 * The rich content behind a stop: photos, rating, hours, phone, website.
 *
 * Four states rather than the usual data/loading/error three, because "there is
 * nothing to fetch" is a first-class outcome here. A stop typed in by hand has
 * no place id, and a build with no API key has no Places at all — neither is an
 * error, and neither should put a spinner or a red line on the screen. Both
 * land on `none`, and the screen simply shows what it already knows.
 *
 * Fetching goes through the 30-day cache, so opening the same stop twice in an
 * afternoon costs one request, not two.
 */
export type PlaceContent =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; details: PlaceDetails }
  | { status: 'error'; message: string; retry: () => void };

export function usePlaceContent(placeId: string | null): PlaceContent {
  const enabled = !!placeId && hasApiKey();
  const [state, setState] = useState<PlaceContent>(
    enabled ? { status: 'loading' } : { status: 'none' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !placeId) {
      setState({ status: 'none' });
      return;
    }

    // Guards against a stop being opened, closed and reopened faster than the
    // request resolves, which would otherwise show the first stop's photos.
    let live = true;
    setState({ status: 'loading' });

    placeDetails(placeId)
      .then((details) => {
        if (live) setState({ status: 'ready', details });
      })
      .catch((e: unknown) => {
        if (!live) return;
        // A missing key is not a failure to report; there is simply nothing to
        // show, which the screen already handles gracefully.
        if (e instanceof PlacesError && e.kind === 'no-key') {
          setState({ status: 'none' });
          return;
        }
        setState({
          status: 'error',
          message:
            e instanceof PlacesError
              ? e.message
              : "Couldn't load details for this place.",
          retry: () => setAttempt((n) => n + 1),
        });
      });

    return () => {
      live = false;
    };
  }, [enabled, placeId, attempt]);

  return state;
}

/**
 * Waypoint sync.
 *
 * The whole server, and deliberately almost nothing. All the difficult parts
 * of sync — deciding whose edit is newer, keeping deletions from coming back,
 * converging two devices without a referee — happen on the phone, in
 * `src/sync/`. What is left for a server is to hold a blob and give it back.
 *
 * That is why this fits on a free plan and in one file. There are no accounts,
 * no schema and no migrations, so there is nothing here to break as the app
 * changes shape.
 *
 * Two endpoints, keyed by a sync code:
 *
 *   GET  /v1/trips/:code   the stored snapshot, or 404 the first time
 *   PUT  /v1/trips/:code   replaces it
 *
 * The device GETs, merges locally, and PUTs the result. Two devices sharing a
 * code converge; so do two people, which is what makes this collaboration as
 * well as sync.
 */

export interface Env {
  SNAPSHOTS: R2Bucket;
}

/** Long enough that guessing one is not worth anybody's afternoon. */
const CODE_PATTERN = /^[0-9a-hjkmnp-tv-z]{26}$/;

/** A trip with everything in it is tens of kilobytes; this is a wide margin. */
const MAX_BYTES = 5 * 1024 * 1024;

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  // The app is the only client, but a browser build of it is a legitimate one.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-Match',
  'Cache-Control': 'no-store',
};

function problem(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    const url = new URL(request.url);
    const match = /^\/v1\/trips\/([^/]+)$/.exec(url.pathname);
    if (!match) return problem(404, 'No such endpoint.');

    const code = match[1];
    // The code is the only credential there is, so a weak one is refused
    // outright rather than accepted and quietly guessable.
    if (!CODE_PATTERN.test(code)) return problem(400, 'That is not a sync code.');

    const key = `trips/${code}.json`;

    if (request.method === 'GET') {
      const object = await env.SNAPSHOTS.get(key);
      if (!object) return problem(404, 'Nothing stored under that code yet.');
      return new Response(object.body, {
        headers: { ...JSON_HEADERS, ETag: object.httpEtag },
      });
    }

    if (request.method === 'PUT') {
      const length = Number(request.headers.get('Content-Length') ?? '0');
      if (length > MAX_BYTES) return problem(413, 'That snapshot is too large.');

      const body = await request.text();
      if (body.length > MAX_BYTES) return problem(413, 'That snapshot is too large.');

      // Parsed, not merged: the server has no opinion about the contents, but
      // storing something that is not JSON would break every later GET.
      try {
        JSON.parse(body);
      } catch {
        return problem(400, 'That is not JSON.');
      }

      await env.SNAPSHOTS.put(key, body, {
        httpMetadata: { contentType: 'application/json' },
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
    }

    return problem(405, 'Use GET or PUT.');
  },
};

/**
 * SQLite schema.
 *
 * Money columns are INTEGER minor units (paise/cents), never REAL — float
 * accumulation drifts once you sum a few hundred small expenses.
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  total_budget INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  google_place_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  lat REAL,
  lng REAL,
  rating REAL,
  photo_ref TEXT,
  sequence INTEGER NOT NULL,
  planned_budget INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  stop_id TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  estimated_cost INTEGER,
  done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS food_plans (
  id TEXT PRIMARY KEY,
  stop_id TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  google_place_id TEXT,
  name TEXT NOT NULL,
  cuisine TEXT,
  estimated_cost INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_id TEXT REFERENCES stops(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('food','activity','transport','lodging','other')),
  amount INTEGER NOT NULL,
  note TEXT,
  spent_at TEXT NOT NULL
);

-- Places API responses, cached to keep billing down. See src/api/placesCache.ts.
CREATE TABLE IF NOT EXISTS places_cache (
  cache_key TEXT PRIMARY KEY,   -- '<requestType>:<placeId>'
  request_type TEXT NOT NULL,   -- 'details' | 'nearby'
  place_id TEXT NOT NULL,
  payload TEXT NOT NULL,        -- JSON
  fetched_at INTEGER NOT NULL   -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_stops_trip_sequence ON stops(trip_id, sequence);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_stop ON expenses(trip_id, stop_id);
CREATE INDEX IF NOT EXISTS idx_activities_stop ON activities(stop_id);
CREATE INDEX IF NOT EXISTS idx_food_plans_stop ON food_plans(stop_id);
CREATE INDEX IF NOT EXISTS idx_places_cache_fetched ON places_cache(fetched_at);
`;

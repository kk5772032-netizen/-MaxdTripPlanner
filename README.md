# Waypoint

Plan a trip as a sequence of stops — India Gate, Humayun's Tomb, Connaught
Place — and for each stop plan what to do, where to eat, and what it should
cost. Then log what you actually spend and watch it against the plan.

Expo (React Native) + TypeScript. Everything lives on the device: no account,
no server, no sync.

---

## Quick start

```bash
npm install
cp .env.example .env      # then add your API keys — see below
npm start
```

Press `a` for Android, `i` for iOS, or scan the QR code with Expo Go.

The app runs without any API keys — you just add stops by typing them instead
of searching, and the map and nearby-restaurant features stay switched off with
an explanation in place of each. Nothing crashes and nothing is hidden.

> **Native modules.** `react-native-maps` and `@react-native-community/datetimepicker`
> are not in the Expo Go binary. Expo Go is fine for everything else; for the map
> you need a development build:
>
> ```bash
> npx expo prebuild
> npx expo run:android   # or: npx expo run:ios
> ```

### Other commands

```bash
npm test           # jest
npm run typecheck  # tsc --noEmit
```

---

## Google API keys

Two **separate** keys, both from the [Google Cloud Console](https://console.cloud.google.com/):

| `.env` variable | Google API to enable | Used for |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_PLACES_KEY` | **Places API (New)** | Autocomplete, Place Details, Nearby Search, Photos |
| `EXPO_PUBLIC_GOOGLE_MAPS_KEY` | **Maps SDK for Android** (+ **Maps SDK for iOS**) | Rendering the map |

Keeping them separate lets you restrict and cap each one independently. Restart
the dev server after editing `.env` — Expo reads `EXPO_PUBLIC_*` at build time.

### Getting and restricting the Places key

1. Cloud Console → **APIs & Services → Library** → enable **Places API (New)**.
   (Not "Places API" — the old one. This app uses the new REST endpoints.)
2. **APIs & Services → Credentials → Create credentials → API key**.
3. Open the new key and set **API restrictions → Restrict key → Places API (New)**,
   and nothing else. An unrestricted key that leaks is an unrestricted bill.
4. Paste it into `.env` as `EXPO_PUBLIC_GOOGLE_PLACES_KEY`.

Repeat for the Maps key, restricting that one to **Maps SDK for Android** and
**Maps SDK for iOS**.

> **The key ships inside the app.** `EXPO_PUBLIC_*` values are compiled into the
> JavaScript bundle, and the Photos endpoint needs the key in a URL. Anyone with
> the app can extract it. That is normal for client-side Google Maps/Places use,
> and it is exactly why the API restriction and the quota cap below are not
> optional. For iOS and Android you can additionally add an **Application
> restriction** (bundle ID / package name + SHA-1) to the Maps key.

### Set a daily quota cap — do this before you start testing

**Places API (New) is a paid API.** There is a monthly credit, and past it you
are billed per request. A loop that accidentally calls Nearby Search on every
render can run up a real bill overnight.

1. Cloud Console → **APIs & Services → Places API (New) → Quotas & System Limits**.
2. Find the per-day request quotas (Autocomplete, Place Details, Nearby Search,
   Place Photos are metered separately).
3. Click the pencil on each and set a **daily limit you are comfortable paying
   for** — a few hundred a day is plenty for development.
4. Also set a **budget alert**: Billing → Budgets & alerts → Create budget.

A quota cap is a hard stop. A budget alert is only an email, after the money is
already spent. Set both, and treat the cap as the one that matters.

### What this app does to keep the bill down

- **Field masks are exactly what each screen renders.** Places (New) picks its
  billing tier from the fields you request, so asking for something you don't
  display costs money for nothing.
- **Autocomplete runs under a session token**, held from the moment the search
  field mounts until you pick a result, then rotated. Google bills the whole
  type-and-select flow as one session instead of per keystroke.
- **300 ms debounce**, and a request already in flight is aborted when you keep
  typing.
- **Place Details and Nearby Search responses are cached in SQLite for 30 days**
  (`places_cache`). A landmark's address doesn't change, and the restaurants near
  it don't change hour to hour.
- **Nearby Search never runs on render.** It runs on your first visit to a stop's
  Food tab, or when you tap Refresh. Nothing else triggers it.
- **Offline falls back to the cache.** If a call fails and there's an expired
  entry, the app serves the stale copy and says so, rather than showing an error.

---

## How it works

### Screens

| Route | What it is |
|---|---|
| `(tabs)/trips` | Trip list. Each card shows dates and a budget-used ring. Long-press to delete. |
| `new-trip` | Create or edit a trip (`?tripId=` switches it to edit). |
| `trip/[tripId]` | Itinerary or map, per-stop budget bars, sticky trip total. |
| `trip/[tripId]/new-place` | Add a stop: Places autocomplete, or type it by hand. |
| `trip/[tripId]/place/[placeId]` | One stop: Activities, Food, Budget. |
| `trip/[tripId]/expenses` | The whole trip's expense log, filterable by stop and category. |
| `trip/[tripId]/dashboard` | Planned vs actual per stop, spend by category. |

### Money

**Every monetary value is an integer number of minor units** — paise for INR,
cents for USD — from the SQLite column all the way to the budget engine. Floats
appear only when a number is formatted for display. Summing ₹0.10 ten thousand
times gives exactly ₹1000.00, not ₹1000.0000000001589; there's a test that pins
this down.

Three numbers are easy to confuse, so the code keeps them strictly separate:

- **budget** — the cap you set (`trips.total_budget`, `stops.planned_budget`).
  Nullable: "I haven't decided" is different from "zero".
- **planned** — what your activities and food plans add up to.
- **actual** — what you've logged as expenses.

Status compares **actual against the cap**: green under 80%, amber from 80% up
to and including the cap, red past it. Spending exactly your whole budget is not
overspending. The comparison is done by cross-multiplication, so no float ever
enters it.

Expenses can be attached to a stop or left at trip level (flights, visas). Trip
level counts toward the trip total but against no stop's cap. Delete a stop and
its expenses survive, detached to trip level — money you actually spent
shouldn't vanish because you reorganised the itinerary.

### Layout

```
app/                        expo-router file-based routes
src/
  api/places.ts             Places API (New) client — field masks, session tokens
  api/placesCache.ts        30-day SQLite response cache
  budget/engine.ts          pure budget maths (planned/actual/status/totals)
  budget/money.ts           minor-unit parsing and formatting
  db/schema.ts              CREATE TABLE statements
  db/client.ts              expo-sqlite wrapper, swappable for tests
  db/repositories/          one module per table
  state/tripStore.ts        the open trip and everything under it
  state/tripsStore.ts       the trip list
  components/               BudgetBar, StopCard, MapWithRoute, charts, …
```

State is zustand. Actions write to SQLite first, then update local state — the
database is the source of truth and the store is what's on screen. The open
trip's whole graph is loaded at once, which is a few milliseconds of SQLite and
lets every budget selector be a plain synchronous function over arrays.

### Tests

```bash
npm test
```

- `src/budget/engine.test.ts` — threshold boundaries at 79.9% / 80% / 100% /
  100.1%, null budgets, and integer money holding exact over 10,000 expenses.
- `src/db/repositories/repositories.test.ts` — CRUD round-trips and cascade
  behaviour against **real SQLite**. expo-sqlite has no implementation under
  Jest, so `src/db/testSqlite.ts` backs it with Node's built-in `node:sqlite`
  rather than a fake — foreign keys, `ON DELETE CASCADE`/`SET NULL` and CHECK
  constraints are the point of those tests and a fake would assert nothing
  about them.
- `src/api/placesCache.test.ts` — TTL, stale fallback, invalidation.
- `src/components/BudgetBar.test.tsx` — snapshots per status colour, plus
  explicit assertions on the colour and the label, since a snapshot alone would
  happily record a green bar at 150%.

### Deliberate choices worth knowing about

- **The charts are drawn directly on `react-native-svg`**, not with a chart
  library. They're two simple forms, `react-native-svg` was already a dependency,
  and this avoids adding a Skia or linear-gradient native dependency for about
  200 lines of marks.
- **The expense category palette is validated, not eyeballed** — every pair
  clears colourblind-separation and contrast checks, and the hues stay clear of
  the red/amber/green budget-status colours so that red on the dashboard only
  ever means "over budget".
- **No location permission is requested.** The core flow doesn't need it, so the
  app doesn't ask. If you add "use my current location", that's when
  `NSLocationWhenInUseUsageDescription` and `ACCESS_FINE_LOCATION` become
  necessary.

---

## Data and privacy

Everything is stored in a local SQLite database on the device. There is no
account, no server, and no sync — uninstalling the app deletes your trips. The
only data that leaves the device is what you type into place search, which goes
to Google Places.

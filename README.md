# Waypoint

Plan a trip as a sequence of stops — India Gate, Humayun's Tomb, Connaught
Place — and for each stop plan what to do, where to eat, and what it should
cost. Then log what you actually spend and watch it against the plan.

Expo (React Native) + TypeScript. Everything lives on the device: no account,
no server, no sync.

---

## Get the app on your phone

### Option A — let GitHub build it (no account, no Android Studio, no setup)

Open the repo's **Actions** tab → **Android APK** → **Run workflow**. It takes
around fifteen minutes; when it finishes, the APK is attached to the run as a
downloadable artifact. Open that link on your phone, install it, and allow
"install from unknown source" when Android asks — expected for anything that
didn't come from the Play Store.

Tagging a release builds one too:

```bash
git tag v1.0.0 && git push --tags
```

Nothing needs configuring first. The workflow generates the native project
from `app.json`, so `android/` is never committed and can't drift out of sync
with the app config.

The APK is signed with the debug keystore Expo's template ships. That is the
right default for sideloading — it's stable across builds, so updates install
over the top — but it is **not** suitable for the Play Store, which needs a
keystore of your own.

Two optional repository secrets get baked in when present:
`EXPO_PUBLIC_GOOGLE_PLACES_KEY` turns on place search, and
`EXPO_PUBLIC_GOOGLE_MAPS_KEY` makes the map draw tiles. Without them the app
still works — stops are added by typing, photos and opening hours are simply
absent rather than broken, and Directions still opens Google Maps, because that
is a URL rather than an API call. The map is the only thing that looks empty.

### Option B — build an APK with EAS

[EAS Build](https://docs.expo.dev/build/introduction/) compiles on Expo's
servers and hands back a download link. A free Expo account is enough.

```bash
npm install -g eas-cli
eas login                                  # free account: expo.dev/signup
eas build --platform android --profile preview
```

`eas.json` already defines the `preview` profile as `buildType: apk`, so this
produces an installable **.apk** (not an .aab). When it finishes, EAS prints a
URL — open it on your phone, download, and install. Android will ask you to
allow installing from an unknown source, which is expected for a
non-Play-Store build.

Nothing else needs configuring: the app runs without API keys, and you can add
them later.

### Option C — build the APK locally

Needs the Android SDK (Android Studio, or just the command-line tools) and a
JDK 17+.

```bash
npm install
npx expo prebuild --platform android     # generates ./android
cd android
./gradlew assembleRelease
# APK lands at: android/app/build/outputs/apk/release/app-release.apk
```

`assembleDebug` is faster and doesn't need a signing key, if you just want to
try it.

### Option D — run it live while you develop

```bash
npm install
cp .env.example .env      # optional, see API keys below
npm start
```

Press `a` for Android, `i` for iOS, or scan the QR code with Expo Go.

The app runs without any API keys — you just add stops by typing them instead
of searching, and the map and nearby-restaurant features stay switched off with
an explanation in place of each. Nothing crashes and nothing is hidden.

> **Expo Go limits.** `react-native-maps` and the date picker aren't in the Expo
> Go binary, so the map won't render there. Everything else works. A dev build
> (`npx expo prebuild && npx expo run:android`) or an APK from Option A has the
> full feature set.

### Running it in a browser

```bash
npm run web
```

Useful for quick checks — the whole app runs except the map, which is
native-only and shows the stop list with coordinates instead
(`MapWithRoute.web.tsx`).

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
| `EXPO_PUBLIC_GOOGLE_PLACES_KEY` | **Places API (New)** + **Routes API** | Autocomplete, Place Details, Nearby Search, Photos, travel times |
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
  display costs money for nothing. Details and Nearby ask for hours, review
  counts, price level, phone and website — all Enterprise-tier fields, which the
  rating already put the call in, so they ride along rather than costing extra.
  Nothing that would push either call to Enterprise+ is requested.
- **Autocomplete runs under a session token**, held from the moment the search
  field mounts until you pick a result, then rotated. Google bills the whole
  type-and-select flow as one session instead of per keystroke.
- **300 ms debounce**, and a request already in flight is aborted when you keep
  typing.
- **Place Details and Nearby Search responses are cached in SQLite for 30 days**
  (`places_cache`). A landmark's address doesn't change, and the restaurants near
  it don't change hour to hour.
- **Nearby Search never runs on render.** It runs on your first visit to a stop's
  Food tab, when you tap "What else is nearby?", or when you tap Refresh.
  Nothing else triggers it, and food and things-to-do are cached separately so
  one never evicts the other.
- **Travel times are one request per pair of places, ever.** The Routes API call
  asks for two numbers, the answer is cached for 30 days, and the coordinates
  are rounded to about eleven metres before they become a cache key so nudging a
  pin doesn't buy the same answer twice. Whether to drive or walk is decided on
  the device from the straight-line distance — asking Google for a driving time
  between two museums 400 m apart spends money on an answer nobody wants. The
  whole feature has an off switch in Settings.
- **Offline falls back to the cache.** If a call fails and there's an expired
  entry, the app serves the stale copy and says so, rather than showing an error.
- **Open or closed is computed locally.** Google's `openNow` is only true at the
  moment it was computed, and these responses are cached for thirty days, so the
  structured periods are stored and the question is answered from the clock —
  in the place's own timezone — every time it's asked.
- **Directions cost nothing.** Handing a place to Google Maps is a plain URL, not
  a billed API call, so it works with no Places key at all.

---

## How it works

### Screens

| Route | What it is |
|---|---|
| `(tabs)/index` | Today: the trip you're on, what's next, what's left to do. |
| `(tabs)/trips` | Trip list. Each card shows dates and a budget-used ring. Long-press to delete. |
| `new-trip` | Create or edit a trip (`?tripId=` switches it to edit). |
| `trip/[tripId]` | Itinerary or map, per-stop budget bars, sticky trip total. |
| `trip/[tripId]/new-place` | Add a stop: Places autocomplete, or type it by hand. |
| `trip/[tripId]/place/[placeId]` | One stop: Activities, Food, Budget. |
| `trip/[tripId]/expenses` | The whole trip's expense log, filterable by stop and category. |

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
  backup/backup.ts          every trip as one file, and back again
  backup/format.ts          what a backup is, and what makes one invalid
  itinerary/calendar.ts     the trip as a standard .ics file
  itinerary/exportPlan.ts   the plan as shareable text and as a PDF-ready page
  itinerary/now.ts          which trip you are on, and what happens next
  itinerary/reminders.ts    what a booking is worth being reminded about
  packing/templates.ts      starter packing lists by trip type
  db/repositories/journal.ts  what happened on a day, and its photos
  itinerary/sharePlan.ts    printing and the share sheet
  api/routes.ts             Routes API client — travel time between two stops
  itinerary/travel.ts       which pairs to ask about, and whether a day fits
  places/hours.ts           open-or-shut from the clock, in the place's timezone
  places/maps.ts            Google Maps handoff — directions, place, whole route
  places/usePlaceContent.ts fetches a stop's photos, rating and hours
  budget/engine.ts          pure budget maths (planned/actual/status/totals)
  budget/money.ts           minor-unit parsing and formatting
  db/schema.ts              CREATE TABLE statements
  db/client.ts              expo-sqlite wrapper, swappable for tests
  db/repositories/          one module per table
  state/tripStore.ts        the open trip and everything under it
  state/tripsStore.ts       the trip list
  theme/palette.ts          the two palettes, light and dark
  theme/index.tsx           ThemeProvider + makeStyles
  tokens.ts                 spacing, radii, type scale, elevation
  components/               BudgetBar, StopCard, MapWithRoute, charts, …
```

State is zustand. Actions write to SQLite first, then update local state — the
database is the source of truth and the store is what's on screen. The open
trip's whole graph is loaded at once, which is a few milliseconds of SQLite and
lets every budget selector be a plain synchronous function over arrays.

### Theming

Appearance follows the system by default and can be pinned to light or dark in
Settings. Colour lives in `src/theme/palette.ts`; everything that isn't colour
(spacing, radii, the type scale, elevation) lives in `src/tokens.ts` and is
shared by both palettes.

Styles are written with `makeStyles`, which mirrors `StyleSheet.create` but
takes the palette:

```ts
const useStyles = makeStyles((t) => ({
  card: { backgroundColor: t.surface, borderColor: t.border },
  title: { ...type.heading, color: t.text },
}));
```

Sheets are built once per palette and cached, so switching themes rebuilds them
and re-rendering does not.

The dark palette is derived rather than inverted, and a few tokens exist only
because inverting would have been wrong:

- **`primary` vs `accent`.** `primary` is the tint for links and icons on the
  app's own ground, so in dark it has to be light. `accent` is the ground
  *under* white text — buttons, the FAB, the recap hero — so in dark it has to
  be darker. One token could not be both: white on the dark theme's link blue
  measures 3.4:1.
- **`under`/`near`/`over` vs `underText`/`nearText`/`overText`.** A green
  bright enough to read as a bar on white is too light to read as a word on
  white.
- **`surfaceRaised`.** The selected pill in a segmented control. Using the card
  surface would have made it *darker* than the track it sits in — it read as
  the unselected half.

`src/theme/palette.test.ts` checks every one of those pairings against WCAG AA
in both palettes, so a token change that looks fine but fails contrast fails
the build instead.

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
- `src/theme/palette.test.ts` — contrast for every token pairing the app
  actually renders, in both palettes: 4.5:1 for text, 3:1 for the graphics you
  have to read (bars, arcs, pie slices).
- `src/components/BudgetBar.test.tsx` — snapshots per status colour, plus
  explicit assertions on the colour and the label, since a snapshot alone would
  happily record a green bar at 150%.
- `src/screens.smoke.test.tsx` — every screen mounted against a real in-memory
  database with real rows, rendered with a 34pt bottom safe-area inset. Unit
  tests over pure functions say nothing about whether a screen renders at all.

Beyond Jest, the app is driven end to end in a real browser (`npm run web` plus
Playwright): 23 checks covering trip CRUD, stops, reordering, activities, food
plans, stop caps, expense add/edit/filter, the roll-ups, the breakdown, the map
and the delete cascades, plus a theme pass that walks all seven screens in each
appearance and asserts on the colour actually painted.

### Deliberate choices worth knowing about

- **The charts are drawn directly on `react-native-svg`**, not with a chart
  library. They're two simple forms, `react-native-svg` was already a dependency,
  and this avoids adding a Skia or linear-gradient native dependency for about
  200 lines of marks.
- **The expense category palette is validated, not eyeballed** — every pair
  clears colourblind-separation and contrast checks, and the hues stay clear of
  the red/amber/green budget-status colours so that red on the breakdown only
  ever means "over budget".
- **No location permission is requested.** The core flow doesn't need it, so the
  app doesn't ask. If you add "use my current location", that's when
  `NSLocationWhenInUseUsageDescription` and `ACCESS_FINE_LOCATION` become
  necessary.
- **Destructive actions go through `src/confirm.ts`, not `Alert.alert`.**
  `Alert` is native-only — react-native-web ships it as a stub, so every delete
  in the app was silently dead in a browser. That helper routes to
  `window.confirm` on web and keeps the native dialog everywhere else.

---

## Data and privacy

Everything is stored in a local SQLite database on the device. There is no
account, no server, and no sync — uninstalling the app deletes your trips. The
only data that leaves the device is what you type into place search, which goes
to Google Places, and the place you tap Directions for, which goes to Google
Maps in the URL that opens it.

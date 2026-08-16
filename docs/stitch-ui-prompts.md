# Waypoint — Stitch Prompt Pack

Production-grade UI/UX prompts for [Google Stitch](https://stitch.withgoogle.com),
covering every screen, state, notification and cross-cutting concern in Waypoint.

Each prompt is self-contained and paste-ready. `S0` is the shared design system —
paste it once at the start of a Stitch project, then run screen prompts one at a
time. Prompts marked **NEW** describe screens the app doesn't have yet; they are
the highest-value additions to design.

---

## How to use this pack

1. Open Stitch and create a **Mobile** project.
2. Paste **S0 — Design system** as the first prompt. It sets palette, type and
   component vocabulary for everything that follows.
3. Run screen prompts **one at a time**, in order. Stitch generates one screen
   per prompt; batching them produces mush.
4. Refine with short follow-ups rather than re-running the whole prompt —
   "make the bottom bar sticky", "raise the contrast on the amber chip",
   "show the over-budget state instead".
5. Use **Experimental mode** for the hero screens (P03, P07, P17) where fidelity
   matters most; Standard mode is fine for forms and settings.
6. Export to Figma, then hand off against the **Quality bar** at the end — it is
   the review checklist, not a wish list.

**Every screen prompt assumes S0 is already in context.** If you start a fresh
Stitch project, paste S0 again first.

---

## S0 — Design system

Purpose: the shared foundation. Paste once per project, before any screen.

```prompt
You are designing Waypoint, a mobile trip-planning and budget-tracking app.

PRODUCT
Waypoint lets a traveller plan a trip as an ordered sequence of stops (India
Gate, Humayun's Tomb, Connaught Place). For each stop they plan things to do,
where to eat, and a spending cap. During the trip they log what they actually
spend, and the app shows planned vs actual against every cap. All data is local
to the device: no account, no sign-in, no sync.

AUDIENCE AND TONE
Adults planning leisure travel, often on the move, often one-handed, sometimes
on poor connections. Confident and plain-spoken. Never cute, never salesy.
Money is the emotional core: the design must make "am I overspending?"
answerable in one glance.

PLATFORM
Mobile first, 390 x 844pt. Design for both iOS and Android conventions.
Respect safe areas: 47pt top, 34pt bottom gesture inset. Any bottom-fixed bar
must sit above the inset, never under it.

COLOUR — surfaces and text
Background        #F6F7F9
Surface (cards)   #FFFFFF
Sunken surface    #F2F4F7   (inputs, tracks, grouped rows)
Border            #E4E7EC
Border strong     #D0D5DD
Text primary      #0C111D
Text secondary    #5D6B82
Text tertiary     #98A2B3

COLOUR — brand
Primary           #2563EB
Primary pressed   #1D4FD7
Primary soft      #EFF4FF   (tinted fills, selected chips)

COLOUR — budget status (semantic, reserved, never decorative)
Under budget      #12B76A on #ECFDF3
Near cap (>=80%)  #F79009 on #FFFAEB
Over budget       #F04438 on #FEF3F2
No budget set     #98A2B3 on #F2F4F7

COLOUR — expense categories (identity, never reused as decoration)
Food        #DC6803
Activity    #2E90FA
Transport   #9E33D6
Lodging     #039855
Other       #8D97A5
These four chromatic hues are a validated categorical palette: every adjacent
pair clears colourblind-separation and contrast checks. Do not substitute them
by eye. "Other" is intentionally neutral grey — it is a residual bucket, not a
fifth identity. Category colours are deliberately kept clear of the status
colours above, so that red anywhere in this app means "over budget" and nothing
else.

TYPOGRAPHY
Use a clean geometric or neo-grotesque sans (Inter, Roboto or the platform
default). One family throughout. Scale, with line height:
Display     30 / 36, weight 700, tracking -0.5   (dashboard hero number)
Title       22 / 28, weight 700, tracking -0.3   (screen titles)
Heading     17 / 22, weight 600, tracking -0.2   (card and section titles)
Body        15 / 21, weight 400
Body strong 15 / 21, weight 600
Label       13 / 18, weight 600                  (field labels, chips, meta)
Caption     12 / 16, weight 400                  (hints, timestamps)
Amount      15 / 20, weight 700, tabular figures (money in rows)
All money uses tabular/lining figures so columns of digits align.

SPACING AND SHAPE
Spacing scale: 4, 8, 12, 16, 24, 32. Screen gutter 16.
Radius: 8 small, 12 medium, 16 cards, 20 large, 999 pills.
Elevation, kept very soft — never heavy drop shadows:
  Level 1 cards:  y2 blur6 at 4% black
  Level 2 raised: y4 blur12 at 7% black
  Level 3 FAB / sticky bars: y8 blur20 at 12% black

ICONOGRAPHY
Outline icons, 1.5–2px stroke, rounded caps (Material Symbols Rounded or
Ionicons outline). 24px default, 20px inline, 16px in dense meta rows. Icons
always pair with a text label except in a FAB or a well-established affordance.

CORE COMPONENTS
- Budget bar: a 10px rounded track (6px in compact rows), filled left to right
  in the status colour, with a faint vertical tick marking "planned" against the
  cap. ALWAYS labelled with its numbers, e.g. "₹12,500 of ₹15,000". Never a bare
  bar. Past the cap the fill stays full and a red line beneath reads
  "₹2,300 over budget".
- Budget ring: 44px circular progress, same status colours, centred percentage
  label. Shows an em dash when no budget is set.
- Stop card: numbered circular badge (1, 2, 3) in primary-soft, stop name,
  address, a meta line ("2 activities · 3 food spots"), a compact budget bar,
  a star rating chip if present, and a drag handle on the right.
- Chip: pill, 36pt min height, outline by default; when selected takes an 8%
  tint of its own colour with a matching border.
- Segmented control: sunken track, 4px padding, the active segment a white
  raised pill with icon and label.
- Notice: soft-tinted inline block with a leading icon, optional bold title, and
  explanatory body. Tones: info (blue), warning (amber), danger (red).
- Empty state: 56px circular primary-soft icon badge, heading, one or two lines
  of body, and a single primary action.

MONEY FORMATTING
Default currency INR, symbol ₹. Indian digit grouping: ₹12,34,567 not
₹1,234,567. Other currencies use standard grouping. Compact display in bars,
rings and charts drops the decimals (₹12,500); full precision appears in
expense rows and detail figures (₹12,500.00).

RULES
- Minimum tap target 44 x 44pt.
- Never encode meaning in colour alone: pair every status colour with a label,
  icon or number.
- Body text at least 4.5:1 contrast; large text and UI at least 3:1.
- Prefer showing a number over showing a chart when only one number matters.
- No gradients on surfaces, no glassmorphism, no drop-shadow-heavy cards, no
  purple-to-blue hero gradients. Restraint is the house style.
```

---

## P01 — Onboarding **NEW**

Purpose: three swipeable panels on first launch. The app currently drops the
user straight into an empty list, which under-sells what it does.

```prompt
Design a 3-panel onboarding carousel for Waypoint, first launch only.

Layout per panel: a large centred illustration area (60% of the screen), a
22/28 700 headline, a 15/21 400 body line of at most two sentences, a 3-dot
pager, a full-width primary "Next" button, and a low-emphasis "Skip" text
button in the top right.

Panel 1 — "Plan the route, not just the trip"
Body: "Add the places you want to see, in the order you'll see them."
Illustration: three numbered waypoint pins connected by a dashed path over a
simplified light map, in primary blue.

Panel 2 — "Decide what it should cost"
Body: "Give each stop a budget, then plan the things to do and places to eat
inside it."
Illustration: a stop card with a green budget bar reading "₹800 of ₹3,000",
with a small checklist and a fork-and-knife icon beside it.

Panel 3 — "Watch it as it happens"
Body: "Log what you actually spend. Waypoint tells you the moment a stop starts
running over."
Illustration: a donut chart in the category colours plus an amber "Close to cap"
pill.
Final panel button reads "Get started" instead of "Next".

Illustrations should be flat geometric vector, primary blue plus one status
accent per panel, on the app background. No photography, no 3D, no mascot, no
gradient meshes.
```

---

## P02 — Notification permission priming **NEW**

Purpose: ask *before* the OS dialog, so a "no" isn't permanent. This is the
screen that decides whether budget alerts ever work.

```prompt
Design a bottom-sheet permission priming screen for Waypoint, shown after the
user creates their first trip — never on launch.

Sheet, rounded 20 top corners, over a dimmed background.
Contents top to bottom:
- 56px primary-soft circular badge with a bell outline icon.
- Heading 22/28 700: "Know before you overspend"
- Body 15/21: "Waypoint can tell you when a stop passes 80% of its budget, and
  remind you to log what you spent at the end of each day. Nothing else."
- A 3-row list, each row a 20px outline icon, a 15/21 600 label and a 13/18
  secondary line:
    Alert icon — "Budget alerts" / "When a stop or the trip nears its cap"
    Clock icon — "Daily reminder" / "One nudge each evening while you're away"
    Lock icon — "Nothing leaves your phone" / "No account, no tracking"
- Primary full-width button: "Turn on alerts"
- Ghost button below: "Not now"

Make the honesty of the third row visually equal to the other two — it is the
reason people say yes. No dark patterns: "Not now" is a real, comfortably
tappable button, not faint grey small text.
```

---

## P03 — Trips list (populated)

Purpose: the app's home. Every trip's health readable without opening it.

```prompt
Design the "Trips" home screen for Waypoint — a scrolling list of trip cards.

Large title header "Trips" (22/28 700) on white, no shadow, hairline bottom
border. A bottom tab bar with a single "Trips" tab, filled map icon, primary
blue when active.

Trip card (radius 16, white, level-1 elevation, 16 padding, 12 gap):
Top row —
  Left column: trip name at 17/22 600; then two meta rows, each a 13px outline
  icon plus 12/16 secondary text: a calendar icon with "4–7 Nov 2025 · 4d", and
  a location pin with "3 stops".
  Right: a 44px budget ring showing percentage of budget spent, coloured by
  status, e.g. an amber ring reading "83%".
Divider, then footer row —
  Left: "₹12,500 of ₹15,000" at 13/18 600 in primary text.
  Right: a status pill — green "On track", amber "Close to cap", or red
  "Over budget" — in its soft background with its own colour text. If the trip
  has no budget, show plain tertiary text "No budget set" instead of a pill.

Show four cards in different states so the system is visible at a glance:
1. "Delhi weekend" — amber, 83%, "Close to cap"
2. "Kerala backwaters" — green, 34%, "On track"
3. "Tokyo, spring" — red, 118%, "Over budget", currency ¥
4. "Someday: Patagonia" — no dates, no budget, grey ring showing an em dash

A primary circular FAB, 58px, plus icon, bottom right, floating above the tab
bar with level-3 elevation.

Long-press on a card is the delete affordance — do not add a visible trash icon
to the card.
```

---

## P04 — Trips list: empty, loading, error

Purpose: the three states people actually hit on day one.

```prompt
Design three states of the Waypoint "Trips" screen as separate frames.

FRAME A — Empty (first run, no trips)
Vertically centred empty state: 56px primary-soft circle with an outline map
icon; heading 17/22 600 "No trips yet"; body 15/21 secondary, centred, max two
lines: "Plan a trip as a sequence of stops — what to do, where to eat, and what
it should cost."; then a full-width primary button "Create your first trip"
with a plus icon. No FAB in this state — the button is the call to action.

FRAME B — Loading
Three skeleton cards matching the real card's geometry: a 40px circle on the
right, two rounded grey bars at 55% and 35% width, on a white card with level-1
elevation. Sunken-surface grey (#F2F4F7), gentle shimmer left to right. No
spinner. The skeleton must occupy the same footprint as a loaded card so
nothing jumps when data arrives.

FRAME C — Error
The list with a danger Notice pinned above it: red alert-circle icon, bold red
title "Couldn't load your trips", body in secondary text explaining what to do.
The rest of the screen keeps its normal chrome. Errors never take over the whole
screen.
```

---

## P05 — Create trip

Purpose: the first real form. Four fields, no ceremony.

```prompt
Design the "New trip" screen for Waypoint, presented as a modal sheet with a
"Cancel" text button top left and the title "New trip" centred.

Fields top to bottom, each with a 13/18 600 secondary label above it and 16pt
of space between groups:

1. "Trip name" — single-line text input, radius 12, 1px border, 48pt tall,
   placeholder "Delhi long weekend". Shown focused, with a primary-blue border.

2. "Dates" — two side-by-side tappable date fields, each a bordered box with a
   12/16 secondary caption ("Start" / "End") above a 15/21 500 value
   ("4 Nov 2025" / "Not set"). Below them a low-emphasis "Clear dates" text
   button. Show an inline calendar picker expanded under the Start field, in the
   platform's own style, with the selected date in primary blue.

3. "Currency" — a wrapping row of pill chips: INR, USD, EUR, GBP, JPY, AUD,
   CAD, SGD, AED, THB. INR selected: primary-soft fill, primary border, primary
   text. The rest outline only.

4. "Total budget" — an amount input with a ₹ symbol in secondary text inside the
   left of the field, numeric keypad implied. Hint below in 12/16 tertiary:
   "Optional. Leave empty to track spending without an overall cap."

Bottom: full-width primary button "Create trip" with a plus icon, 50pt tall.

The Create button is disabled (45% opacity) until the name has content — show
the enabled state.
```

---

## P06 — Edit trip

Purpose: same form, different intent, plus the destructive path.

```prompt
Design the "Edit trip" variant of the Waypoint trip form (see P05 layout).

Differences from Create:
- Title reads "Edit trip". Fields are pre-filled: name "Delhi weekend", dates
  "4 Nov 2025"/"7 Nov 2025", INR selected, budget "15000".
- Primary button reads "Save changes" with a checkmark icon.
- Below it, separated by 16pt, a full-width DANGER button: solid #F04438,
  white text, trash outline icon, label "Delete trip".

Also design the confirmation dialog that "Delete trip" opens:
Centred alert, radius 16, white, level-3 elevation, dimmed backdrop.
Title 17/22 600: "Delete trip?"
Body 15/21 secondary: "Delhi weekend and everything in it — stops, activities,
food plans and expenses — will be removed."
Two actions: "Cancel" (ghost, secondary text) and "Delete" (red text, weight
600). Destructive action on the right, never pre-selected, never the same
colour as the safe one.
```

---

## P07 — Trip detail: itinerary

Purpose: the app's most-used screen. Ordered stops, per-stop health, running
trip total pinned in view.

```prompt
Design the trip detail screen for Waypoint, itinerary view.

Header: back chevron, title "Delhi weekend" (17/22 600), and a right action
"Edit" with a pencil-outline icon, in primary blue, inset 16 from the edge.

Below the header, a scrolling area:
- A meta row: 14px calendar outline icon plus "4–7 Nov 2025" in 12/16 secondary.
- A full-width segmented control with two segments, "Itinerary" (list icon) and
  "Map" (map icon). Itinerary is active: white raised pill on a sunken track.
- An amber warning Notice: "Connaught Place is over its budget."
- A 12/16 tertiary hint: "Drag a handle to reorder stops."
- Then the ordered stop cards, 12pt apart:

Stop card (white, radius 16, level-1, 16 padding):
  Row: a 28px primary-soft circle with the sequence number in 12/16 700 primary;
  then a column with the stop name (15/21 600), address (12/16 secondary), and a
  meta line (12/16 tertiary) "2 activities · 3 food spots"; then a star chip
  showing "4.6" on sunken grey; then a reorder handle icon in tertiary grey.
  Below the row, a compact 6px budget bar with its numbers above it, right
  aligned, at 12/16.

Show three stops:
  1. India Gate — green bar "₹450 of ₹3,000"
  2. Humayun's Tomb — amber bar "₹1,900 of ₹2,200"
  3. Connaught Place — red bar "₹4,300 of ₹3,500", with "₹800 over budget" in
     red 12/16 beneath it

STICKY BOTTOM BAR (level-3 elevation, white, hairline top border, sitting above
the 34pt safe-area inset):
  Row 1: "Trip total" label left, "₹6,650 of ₹15,000" right, both 13/18 600;
  beneath them a full-width 10px budget bar in amber with a faint planned tick.
  Row 2: left, a receipt outline icon plus "12 expenses" in primary blue; right,
  "₹8,350 left" in primary blue followed by a small bar-chart icon.
  Both halves of row 2 are tappable.

A primary FAB with a plus icon, bottom right, floating clear of the sticky bar
— it must not overlap the bar's numbers.
```

---

## P08 — Trip detail: map

Purpose: the same itinerary, spatially.

```prompt
Design the map view of the Waypoint trip detail screen.

Same header, meta row and segmented control as P07, with "Map" now the active
segment. Below the control, a 12/16 tertiary hint: "Tap a pin, then its label,
to open that stop."

The map fills the remaining space above the sticky bottom bar, inset 16 from
each side, corners rounded 16, clipped.

On the map:
- Numbered custom pins: a 28px primary-blue circle with a 2px white border and
  the sequence number in white 12/16 700. Three pins.
- A dashed primary-blue polyline, 3px, connecting them in sequence order.
- One pin shown selected, with a callout bubble above it: white, radius 12,
  level-2 elevation, containing the stop name in 15/21 600, the address in
  12/16 secondary, and a small chevron indicating it opens the stop.
- A small white pill at the bottom of the map area, level-1: "1 stop has no
  location and isn't shown."

Keep the same sticky bottom trip-total bar from P07. The map must never cover
it.
```

---

## P09 — Add stop: search

Purpose: Google Places autocomplete, the moment a trip becomes real.

```prompt
Design the "Add stop" screen for Waypoint — place search.

Header: back chevron, title "Add stop".

A search field at the top: 48pt tall, radius 12, white, 1px border, a magnifier
outline icon inset left in tertiary grey, placeholder "Search for a place", and
a small activity spinner inset right while querying. Show it focused with a
primary border and the text "india ga" typed.

Directly beneath, an autocomplete dropdown: white, radius 12, 1px border,
clipped, with 5 result rows separated by hairlines. Each row is 56pt tall with
a 15/21 600 primary line and a 12/16 secondary line:
  "India Gate" / "Kartavya Path, New Delhi, Delhi"
  "India Gate Circle" / "Rajpath Area, New Delhi"
  "India Gate Lawns" / "New Delhi, Delhi"
  "Indiana Gate Restaurant" / "Connaught Place, New Delhi"
  "India Gate Metro" / "Central Secretariat, New Delhi"
Highlight the first row in a pressed state (primary-soft background).

Below the dropdown, a low-emphasis primary text button: "Add manually instead".

Keep the whole screen calm: this is a fast, high-frequency interaction, so no
illustrations, no card chrome around the results, and no more than two lines
per result.
```

---

## P10 — Add stop: confirm

Purpose: show what you're about to add before you commit — rating, photo,
address.

```prompt
Design the confirmation state of Waypoint's "Add stop" screen, after a search
result is chosen.

The search field stays at the top, cleared. Below it, a preview card: white,
radius 16, level-1, 16 padding.
  - A 140pt tall photo of the place filling the card width, corners rounded 12,
    with a subtle grey placeholder behind it.
  - Place name "India Gate" at 17/22 600.
  - Address "Kartavya Path, India Gate, New Delhi, Delhi 110001" at 12/16
    secondary.
  - A rating row: a small filled amber star and "4.6" in 12/16 600 secondary.
  - A row of two equal-width buttons with 12pt between them: primary
    "Add this stop" with a plus icon, and secondary outline "Cancel".

Also design the failure variant as a second frame: no preview card; instead a
red danger Notice — "Couldn't load that place" with body "Check your connection,
or add it manually below." — and the manual entry form already expanded beneath
it, pre-filled with the name and address from the search result so the user is
never stranded.
```

---

## P11 — Add stop: manual entry and no-key state

Purpose: the app must be fully usable with no API key and no signal.

```prompt
Design two frames of Waypoint's "Add stop" screen where Places search is
unavailable.

FRAME A — No API key configured
In place of the search field, an info Notice: soft blue background, magnifier
outline icon, bold primary-blue title "Place search is off", body in secondary
text: "Set a Google Places key to search real places. You can still add stops by
typing them below."
Below it the manual form, already expanded:
  "Place name" label + input, placeholder "India Gate"
  "Address" label + input, placeholder "Kartavya Path, New Delhi", hint
  "Optional."
  "Notes" label + multi-line input (80pt tall), placeholder "Best at sunset",
  hint "Optional. Anything worth remembering about this stop."
  Full-width primary button "Add stop" with a plus icon.

FRAME B — Offline
Same manual form, but with an amber warning Notice at the top: "You're offline.
Search needs a connection — type the stop instead and add details later."

In both frames the manual path must look like a first-class way to work, not a
degraded fallback: same field styling, same button weight, no apologetic
microcopy.
```

---

## P12 — Stop detail: To do

Purpose: a checklist with money attached.

```prompt
Design the stop detail screen for Waypoint, "To do" tab.

Header: back chevron, title "India Gate".

Below the header, pinned above the tabs:
- A "Notes" label at 13/18 600 secondary, with a small green "Saved" confirmation
  at the right that appears briefly after typing.
- A multi-line input, 60pt tall, containing "Sunset is best, enter from the
  south gate".

A three-segment control: "To do 3" (checkbox icon), "Food 2" (fork icon),
"Budget" (wallet icon). "To do" active. Counts are part of the label.

Content:
- An add card (white, radius 16, level-1): a full-width text input with
  placeholder "Walk to the war memorial"; below it a row with an amount input
  (₹ prefix, placeholder "Est. cost (optional)") taking the remaining width, and
  a compact primary "Add" button beside it.
- A summary row: "1 of 3 done" left, "Planned ₹1,400" right, both 13/18 600
  secondary.
- A grouped list, white, radius 16, hairline dividers, each row 56pt tall:
    A 24px rounded checkbox, then the task title at 15/21, then its cost at
    13/18 600 secondary, then a small circular trash icon button in red.
    Row 1: checked — green filled checkbox with a white tick, title struck
    through in tertiary grey, "₹200"
    Row 2: unchecked, "Sunset photos at the arch", no cost shown
    Row 3: unchecked, "Boat ride at the canal", "₹1,200"
- A centred 12/16 tertiary hint: "Tap a row to tick it off."

Also design the empty variant: a checkbox-outline empty state, heading "Nothing
planned here yet", body "Add the things you want to do at this stop. Estimated
costs roll up into the stop's planned spend."
```

---

## P13 — Stop detail: Food

Purpose: nearby restaurants from Places, plus a manual path — and the cached
and offline variants.

```prompt
Design the "Food" tab of Waypoint's stop detail screen.

Same header, notes block and segmented control as P12, with "Food 2" active.

Section 1 — "Your food plan"
Section header row: title "Your food plan" at 17/22 600, right-aligned
"Planned ₹1,600" at 13/18 600 secondary.
A grouped white list, radius 16, hairline dividers. Each row: name at 15/21 600,
a 12/16 secondary line combining cuisine and note ("Mughlai · go early"), then a
compact 104pt-wide amount input showing "600", then a small red circular trash
icon button.
Two rows: "Karim's" and "Indian Accent".

Section 2 — "Restaurants nearby"
Section header with the title left and a primary "Refresh" text button with a
refresh icon right.
A grouped white list of 5 results. Each row: name at 15/21 600; a 12/16
secondary meta line joining cuisine, rating and price level with middots, e.g.
"North Indian · ★ 4.4 · ₹₹"; then a pill "Add" button in primary-soft with
primary text. One row shows the added state: a grey "Added" pill, disabled.

Below the list, a low-emphasis primary text button: "Add a place manually
instead".

Design three more frames:
- LOADING: the nearby section replaced by a centred spinner and the caption
  "Finding restaurants nearby…".
- CACHED/OFFLINE: an amber warning Notice above the list reading "Showing a
  cached list — couldn't reach Google just now."
- NO COORDINATES: an info Notice, title "No coordinates for this stop", body
  "This stop was added by hand, so there is nothing to search around. Add places
  to eat below."
```

---

## P14 — Stop detail: Budget

Purpose: the cap, the plan, the actual — and the difference between them made
obvious.

```prompt
Design the "Budget" tab of Waypoint's stop detail screen.

Same header, notes block and segmented control as P12, with "Budget" active.

Card 1 — set the cap
  Label "Budget for this stop" at 13/18 600 secondary.
  An amount input with a ₹ prefix showing "3,000".
  Hint 12/16 tertiary: "The cap you don't want to exceed here. Leave empty for
  no cap."
  Full-width primary button "Save budget" with a checkmark icon.

Card 2 — the picture
  A labelled budget bar: "Spent against budget" left, "₹450 of ₹3,000" right,
  then a 10px green track with a faint vertical tick at the planned position.
  A three-row figure list, each row label left in 15/21 secondary and value
  right in 15/20 700 tabular:
    Planned    ₹1,400
    Actual     ₹450
    Remaining  ₹2,550
  A 12/16 tertiary explanation: "Planned is what your activities and food plan
  add up to. The tick on the bar marks it against your cap."

Then, stacked with 16pt gaps:
  Secondary outline button "View 3 expenses" with a receipt icon.
  Danger solid button "Remove stop" with a trash icon.

Design a second frame in the OVER-BUDGET state: the bar full and red, a red
row beneath it with an alert-circle icon reading "₹1,300 over budget", the
Remaining figure showing "-₹1,300" in red, and the header figure "₹4,300 of
₹3,000".
```

---

## P15 — Expenses log

Purpose: everything spent, filterable, scannable.

```prompt
Design the "Expenses" screen for Waypoint.

Header: back chevron, title "Expenses", right action "Add" with a plus icon in
primary blue.

Filters, stacked with 12pt between:
  A "Stop" label at 13/18 600 secondary, then a horizontally scrolling row of
  pill chips: "All" (selected), "Whole trip", "India Gate", "Humayun's Tomb",
  "Connaught Place". Selected chip uses primary-soft fill with a primary border.
  A "Category" label, then chips: "All" (selected), "Food", "Activity",
  "Transport", "Lodging", "Other" — each with its category icon, and when
  selected tinted with its own category colour rather than blue.

A totals row: "12 expenses" left at 13/18 secondary; "₹6,650.00" right at 22/28
700 tabular.

A grouped white list, radius 16, hairline dividers. Each row, 64pt tall:
  a 34px rounded-square icon tile filled with the category colour at 10% opacity
  and the category icon in full colour; then a column with the note at 15/21 600
  ("Lunch at Karim's") and a 12/16 secondary meta line joining stop and date
  ("India Gate · 4 Nov 2025"); then the amount right-aligned at 15/20 700
  tabular ("₹450.00").
Show six rows across at least four categories, including one trip-level expense
whose meta reads "Whole trip · 2 Nov 2025" with a transport icon and a large
amount "₹8,000.00".

Beneath the list, a centred 12/16 tertiary hint: "Tap to edit, long-press to
delete."

Also design the filtered-empty frame: a filter-outline empty state, heading
"Nothing matches those filters", body "Try widening the stop or category
filter." — with the filter chips still visible and one chip clearly selected, so
the cause is obvious.
```

---

## P16 — Add / edit expense

Purpose: the highest-frequency action in the app during a trip. It must be fast.

```prompt
Design the add-expense form for Waypoint, as an inline card at the top of the
Expenses screen (not a separate route).

Card, white, radius 16, level-1, 16 padding, fields stacked with 16pt gaps:

1. Label "New expense". A large amount input, ₹ prefix in secondary text,
   focused, showing "450". This field is the first thing focused when the form
   opens.

2. Label "Category". A wrapping row of five chips, each with its category icon,
   in the category colours: Food (selected — 8% #DC6803 fill, #DC6803 border and
   text), Activity, Transport, Lodging, Other.

3. Label "Stop". A wrapping row of chips: "Whole trip" with a globe icon, then
   one chip per stop with a location-pin icon. "India Gate" selected in
   primary-soft. Hint 12/16 tertiary: "Leave on 'Whole trip' for flights, visas
   and anything not tied to one place."

4. Label "Date". A bordered field showing "4 Nov 2025" beside a small
   primary-soft "Today" shortcut pill.

5. Label "Note". A single-line input, placeholder "Lunch at Karim's". Hint
   "Optional."

Footer: two equal-width buttons — primary "Add expense" with a checkmark icon,
and secondary outline "Cancel".

Design the edit variant too: the label reads "Edit expense", fields are
pre-filled, and the primary button reads "Save changes".

Optimise the layout for one-handed thumb use: amount and category — the two
fields people always touch — must sit in the lower two-thirds of the sheet when
the keyboard is open.
```

---

## P17 — Dashboard

Purpose: the answer screen. One number first, then the breakdown.

```prompt
Design the "Dashboard" screen for Waypoint — the budget overview for one trip.

Header: back chevron, title "Dashboard".

Card 1 — hero
  Label "Remaining budget" at 13/18 600 secondary.
  The number at 34/40 700, tabular: "₹8,350". If negative it turns red and reads
  "-₹1,240".
  A full-width budget bar beneath, amber, labelled "₹6,650 of ₹15,000".
  An amber warning Notice inside the card when relevant: "This trip is close to
  its total budget."

Row of three equal stat tiles (white, radius 12, level-1, 12 padding):
  "Budget" ₹15,000 · "Planned" ₹9,200 · "Actual" ₹6,650
  Each: 12/16 600 secondary label above a 17/22 600 value.

Card 2 — "Planned vs actual per stop"
  A legend: a grey swatch "Planned", a blue swatch "Actual (coloured by budget
  status)".
  Then one group per stop, 16pt apart. Each group:
    a row with the stop name at 13/18 600 left and its actual at 13/18 600
    right (red if over);
    two stacked horizontal bars sharing one scale, 8px tall, radius 4, with a
    2px gap between them — the upper bar grey for planned, the lower bar in the
    stop's status colour for actual;
    a 11/15 tertiary caption "Planned ₹1,400 · cap ₹3,000".
  Show three stops: one green, one amber, one red where the actual bar clearly
  outruns the planned bar.
  Horizontal bars, not vertical — the category labels are stop names and must
  stay readable.

Card 3 — "Where the money went"
  A donut chart, 180px, 58% inner radius, with a 1.5° gap between slices, using
  the category colours.
  Beneath it a legend list, one row per category: a 10px colour swatch, the
  label at 13/18, the amount at 13/18 600, and the share at 12/16 tertiary right
  aligned in a fixed 38pt column so the percentages line up.
  Rows: Food ₹2,400 36%, Transport ₹1,900 29%, Activity ₹1,350 20%, Lodging
  ₹1,000 15%.
  A 12/16 tertiary footnote: "₹8,000 of this isn't tied to a stop — flights,
  visas and the like."

Never use a dual-axis chart, never a rainbow palette, and never rely on the
donut alone — every slice is direct-labelled in the legend.
```

---

## P18 — Settings **NEW**

Purpose: the app has no settings screen. It needs one for currency defaults,
data export and the API-key state.

```prompt
Design a "Settings" screen for Waypoint, reached from a gear icon on the Trips
screen header.

Grouped list style: 13/18 600 secondary section headers above white grouped
cards with radius 16 and hairline dividers. Rows are 56pt tall with a leading
20px outline icon, a 15/21 label, and either a trailing value in secondary text
with a chevron, a switch, or nothing.

Section "Defaults"
  Currency — trailing "INR ₹" + chevron
  Start week on — trailing "Monday" + chevron

Section "Notifications"
  Budget alerts — switch, on
  Daily expense reminder — switch, on, with a secondary sub-line "Every day at
  8:00 PM while a trip is running"
  Trip starting soon — switch, on

Section "Place search"
  A status row showing a green filled dot and "Places API connected", or an
  amber dot and "No API key set" with a chevron to a help screen.
  Sub-row: "Cached place data" trailing "1.2 MB" and a primary "Clear" text
  button.

Section "Your data"
  Export trips as CSV — chevron
  Export trips as JSON — chevron
  Delete all data — red label, red icon, no chevron

Footer, centred, 12/16 tertiary: "Waypoint 1.0.0 · Everything is stored on this
device. No account, no sync."

The footer is a feature, not fine print — give it room to breathe.
```

---

## P19 — Notification settings detail **NEW**

Purpose: give people precise control so they don't switch everything off.

```prompt
Design the "Notifications" detail screen for Waypoint.

Header: back chevron, title "Notifications".

Top: an info Notice — "Waypoint only notifies you about your own budgets.
Nothing is sent anywhere." — with a lock outline icon.

Section "Budget alerts"
  A master switch row "Budget alerts", on.
  When on, a grouped card beneath:
    A row "Alert me at" with a segmented control of three options: "80%",
    "100%", "Both" — "Both" selected.
    A switch row "Per-stop alerts" with sub-line "When one stop passes its own
    cap", on.
    A switch row "Trip total alerts" with sub-line "When the whole trip passes
    its budget", on.

Section "Reminders"
  Switch row "Daily expense reminder", on, sub-line "A nudge to log what you
  spent".
  A row "Time" with trailing value "8:00 PM" and a chevron.
  Switch row "Trip starting soon", on, sub-line "The evening before your start
  date".

Section "Quiet"
  Switch row "Only while a trip is running", on, sub-line "No notifications
  between trips". Show this as the last row and make it visually prominent — it
  is the setting that keeps the app from becoming annoying.

Disabled sub-rows (when a master switch is off) drop to 45% opacity rather than
disappearing, so the structure stays stable.
```

---

## P20 — Trip recap **NEW**

Purpose: the moment after a trip ends. The most shareable screen in the app.

```prompt
Design a "Trip recap" screen for Waypoint, shown the day after a trip's end
date and reachable later from the trip.

Header: close icon left, title "Delhi weekend", share icon right.

Hero block on a primary-blue background with white text, rounded 20 bottom
corners:
  Eyebrow 12/16 600 uppercase, 0.08em tracking, at 70% white: "4–7 NOV 2025"
  A headline 30/36 700: "You came in ₹2,350 under."
  A sub-line 15/21 at 80% white: "₹12,650 spent of a ₹15,000 budget."
  If over budget instead: "You went ₹1,240 over." on the same blue — do not
  turn the hero red. Blame-free.

Below, on the normal app background:
  A three-tile stat row: "3 stops", "18 expenses", "₹4,216 a day".
  A "Where the money went" donut, same spec as P17.
  A "Biggest single expense" card: category icon tile, "Flights to Delhi",
  "Whole trip · 2 Nov", "₹8,000.00".
  A "By stop" list: each stop name with a compact status-coloured budget bar
  and its actual vs cap.
  A full-width secondary button "Plan a trip like this" that duplicates the
  itinerary into a new trip.

Keep it factual and warm. No confetti, no badges, no gamification, no score.
```

---

## N01 — Push notifications **NEW**

Purpose: the exact copy and layout for every push the app should send. Design as
native notification shades, both platforms.

```prompt
Design a sheet of push notification designs for Waypoint, shown as they appear
on a real lock screen and in an expanded notification shade. Render both an
Android and an iOS variant of each.

App icon: a white dashed route with waypoint dots ending in a map pin, on a
primary blue (#2563EB) rounded square.

Notification 1 — approaching a stop's cap
  Title: "Connaught Place is at 85%"
  Body: "₹2,975 of ₹3,500 spent. ₹525 left at this stop."
  Actions: "Log expense", "View stop"

Notification 2 — over the trip budget
  Title: "Delhi weekend is over budget"
  Body: "₹15,840 spent of ₹15,000. You're ₹840 over."
  Actions: "See dashboard"

Notification 3 — daily reminder while travelling
  Title: "Log today's spending"
  Body: "Day 2 of Delhi weekend. You've logged ₹1,200 so far today."
  Actions: "Add expense", "Nothing today"

Notification 4 — trip starting tomorrow
  Title: "Delhi weekend starts tomorrow"
  Body: "3 stops planned, ₹15,000 budget. 2 stops still have no budget set."
  Actions: "Review trip"

Notification 5 — trip finished
  Title: "How did Delhi weekend go?"
  Body: "You came in ₹2,350 under budget. See the recap."
  Actions: "See recap"

COPY RULES, applied to all five:
- Lead with the specific thing, never with the app name.
- Always carry a real number — a notification with no figure gets swiped away.
- Never scold. "You're ₹840 over" is a fact; "You've overspent again!" is not.
- Under 60 characters for titles, under 120 for bodies.
- Every notification has at least one action that completes a task inline.
```

---

## N02 — In-app toasts **NEW**

Purpose: confirm actions without a dialog, and make destructive actions
recoverable.

```prompt
Design a set of in-app toast/snackbar components for Waypoint.

Base: a dark surface (#0C111D at 96% opacity), radius 12, white text at 15/21,
level-3 elevation, full width minus 16pt gutters, sitting 16pt above the safe
area or above a sticky bar if one is present. A leading 20px icon. Optional
trailing text action in a light primary (#93B4FD), weight 600.

Variants:
1. Success — checkmark icon — "Expense added" — no action.
2. Undo — trash icon — "Expense deleted" — action "Undo". Show a thin progress
   line along the bottom edge indicating the ~5s window.
3. Undo — trash icon — "Stop removed" — action "Undo".
4. Offline — cloud-off icon — "You're offline. Changes are saved on your phone."
   — no action.
5. Error — alert-circle icon, with the icon in #F04438 — "Couldn't reach Google
   Places" — action "Retry".

Rules to show in the sheet:
- One toast at a time; a new one replaces the old rather than stacking.
- Anything destructive gets an Undo toast instead of a pre-emptive confirmation
  dialog — except deleting a whole trip, which keeps its dialog.
- Toasts never cover the primary action of the screen beneath.
- 4 seconds default, 6 seconds when there's an action.
```

---

## N03 — Inline banners and system states

Purpose: the persistent, in-context messages.

```prompt
Design Waypoint's inline Notice component in every tone and context, as one
reference sheet.

Anatomy: soft tinted background, radius 12, 12pt padding, a leading 18px icon
aligned to the first text line, an optional bold title at 13/18 600 in the tone
colour, and body text at 12/16 in secondary with 18pt line height.

INFO (background #EFF4FF, icon and title #2563EB)
  "Place search is off" / "Set a Google Places key to search real places. You
  can still add stops by typing them below."
  "Nothing leaves your phone" / "Waypoint stores everything on this device."

WARNING (background #FFFAEB, icon and title #F79009)
  "Connaught Place is over its budget." (no title, body only)
  "Your plan already costs more than the trip budget."
  "Showing a cached list — couldn't reach Google just now."
  "This trip is close to its total budget."

DANGER (background #FEF3F2, icon and title #F04438)
  "Couldn't load your trips" / with the underlying reason in the body.
  "Couldn't load restaurants" / "Check your connection and try Refresh."

Also design a persistent offline bar: full width, amber, 32pt tall, no radius,
sitting directly under the header with a cloud-off icon and the text "Offline —
showing saved data". It pushes content down rather than overlaying it.

A Notice never contains a spinner, and never occupies more than four lines.
```

---

## N04 — Dialogs

Purpose: only for the irreversible.

```prompt
Design Waypoint's confirmation dialogs as one sheet.

Style: centred, radius 16, white, level-3 elevation, 24pt padding, on a
#0C111D at 45% backdrop. Title 17/22 600, body 15/21 secondary, actions in a row
at the bottom right — the safe action as ghost secondary text, the destructive
action in #F04438 at weight 600.

Dialogs:
1. "Delete trip?" / "Delhi weekend and everything in it — stops, activities,
   food plans and expenses — will be removed." / Cancel · Delete
2. "Remove stop?" / "India Gate, its activities and its food plan will be
   removed. Expenses logged against it are kept as trip-level expenses." /
   Cancel · Remove
3. "Delete all data?" / "Every trip, stop and expense on this device will be
   removed. This can't be undone." / Cancel · Delete everything

Rule shown on the sheet: dialogs are only for actions that cannot be undone.
Everything else uses an Undo toast (N02). Note dialog 2's body explicitly —
telling the user what is preserved is as important as telling them what is lost.
```

---

## X01 — Dark mode

Purpose: the app is light-only today. Dark mode is a genuine gap.

```prompt
Produce a dark theme for Waypoint by re-deriving the S0 palette — not by
inverting it.

Surfaces and text:
Background        #0B0F17
Surface (cards)   #141A24
Sunken surface    #1C232F
Border            #263041
Text primary      #F2F5F9
Text secondary    #9AA8BD
Text tertiary     #6B7A90

Brand: primary #4E86F7 (lifted from #2563EB so it holds contrast on a dark
ground), primary soft #16233C.

Status, lifted for dark grounds:
Under #2BC77F on #10251C · Near #FDB022 on #2A1F0C · Over #FF6B5E on #2B1512

Categories, lifted: Food #F79009 · Activity #63A6FF · Transport #C07DEE ·
Lodging #2BC77F · Other #97A2B2

Rules:
- Elevation is expressed by surface lightness, not by shadow — a raised card is
  a lighter surface, since shadows are invisible on dark grounds.
- Keep the same tap targets, spacing and type scale. Nothing moves.
- Charts keep their category hues but drop grid lines to #263041.
- Re-check that every status colour still reads at 3:1 against #141A24.

Redraw these screens in dark: Trips list (P03), Trip detail itinerary (P07),
Dashboard (P17), and the notification sheet (N01).
```

---

## X02 — Motion

Purpose: motion that explains, not decorates.

```prompt
Specify motion for Waypoint as an annotated sheet with before/after frames.

Durations: 150ms micro (press, checkbox), 250ms standard (sheet, tab change),
350ms large (screen transition). Easing: standard ease-out
cubic-bezier(0.2, 0, 0, 1); decelerate on enter, accelerate on exit.

Specify these:
1. Budget bar fill — animates from its previous width to its new one over 350ms
   when an expense is added, and cross-fades colour if the status changed. The
   number above it counts up in step.
2. Checkbox tick — 150ms scale from 0.8 with the row's text striking through
   over the same duration.
3. Stop reorder — the dragged card lifts to level-3 with a 1.02 scale, others
   slide to make room over 250ms.
4. FAB press — scales to 0.96 and deepens to the pressed primary.
5. Screen push — standard platform slide; the sticky bottom bar does NOT
   animate independently, it belongs to the screen.
6. Toast — enters bottom, 250ms, 16pt travel with a fade; exits 150ms.
7. Skeleton shimmer — a slow 1.4s left-to-right sweep, low contrast.

Rules: nothing bounces, nothing springs past its target, no parallax, no
animated illustrations. Everything must be honoured by "reduce motion" — under
that setting, replace movement with a plain 100ms cross-fade.
```

---

## X03 — Accessibility

Purpose: the review pass that catches what a visual comp hides.

```prompt
Produce an accessibility annotation layer for the Waypoint screens already
designed (P03, P07, P12, P15, P17).

Annotate on each screen:
- Every tap target with its hit-area box, flagging anything under 44 x 44pt.
- Reading order as a numbered overlay, confirming it matches visual order.
- The accessible name for every control that is icon-only — the FAB reads "Add
  stop", the drag handle reads "Reorder India Gate", the trash icon reads
  "Remove Walk the memorial".
- Every budget bar annotated as a progressbar with its value, e.g. "Trip total,
  44 percent".
- Contrast ratios called out for: secondary text on white, tertiary text on
  white, each status colour on its soft background, and white on primary.

Then produce a colourblind check sheet: render the Dashboard (P17) donut and the
per-stop chart under deuteranopia, protanopia and tritanopia simulation, and
confirm every slice remains distinguishable by its direct label even where hues
converge.

Flag anything that fails rather than quietly fixing it — the failures are the
deliverable.
```

---

## X04 — Component sheet

Purpose: the reusable library, extracted.

```prompt
Produce a single component library sheet for Waypoint, laid out as a grid of
labelled specimens on the app background, grouped by type.

Buttons — primary, secondary outline, ghost, danger; each in default, pressed,
disabled and loading (spinner) states; with and without a leading icon.
Inputs — text, multi-line, amount with ₹ prefix, search with icon and spinner;
each in rest, focus, filled and error states.
Chips — outline, selected-primary, selected-category (one per category colour),
disabled; with and without a leading icon.
Segmented control — two-segment and three-segment, with icons and with counts.
Budget bar — under, near, over, no-cap, and compact; with and without the
planned tick; with the over-budget caption.
Budget ring — 34%, 83%, 118%, and the no-budget em-dash state.
Cards — trip card, stop card, stat tile, hero card.
List rows — expense row, activity row, food plan row, nearby restaurant row,
settings row (value, switch, destructive).
Notices — info, warning, danger.
Toasts — success, undo with timer, error.
Empty states — three, with different icons.
Skeletons — trip card, stop card, list row.
FAB — default and pressed.

Label every specimen with its component name and state. Include a spacing and
radius ruler strip, and swatch rows for surfaces, brand, status and categories
with hex values printed beneath each swatch.
```

---

## Quality bar

Review Stitch output against this before accepting it. These are the failures
this pack is written to prevent.

**Reject if:**

- A budget bar or ring appears without its numbers beside it.
- Any status is carried by colour alone, with no label, icon or figure.
- A category colour is reused as decoration, or red appears meaning anything
  other than "over budget".
- A bottom-fixed bar or FAB sits inside the 34pt gesture inset, or the FAB
  overlaps the sticky bar's numbers.
- Any tap target is under 44 x 44pt.
- Placeholder or lorem content survives anywhere — every screen in this pack
  specifies real copy and real figures.
- Money is shown with inconsistent grouping, or INR uses western grouping
  (₹1,234,567 instead of ₹12,34,567).
- A loading state is a bare centred spinner on a list screen where a skeleton
  belongs.
- An empty state has no action, or an error state offers no way forward.
- A destructive action has no confirmation and no undo.
- Cards carry heavy drop shadows, gradients, or glassmorphism.
- The design adds a mascot, confetti, badges, streaks or any gamification.

**Accept when:** a stranger can open any screen and answer "how much have I
spent, and is that a problem?" without tapping anything.

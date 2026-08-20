import { writeFileSync, readFileSync } from 'node:fs';

/** Read each artboard's real frame size so the canvas slot always matches. */
const size = (f) => {
  const s = readFileSync(f, 'utf8');
  const m = s.match(/width:(\d+)px;height:(\d+)px;background/);
  return { w: +m[1], h: +m[2] };
};

const COL = 440, ROW_GAP = 80;
const artboards = [];
let y = 0;

/** Lay a row out left to right, tallest artboard sets the next row's offset. */
function row(files, page, { x0 = 0, gap = COL } = {}) {
  let x = x0, tallest = 0;
  for (const f of files) {
    const { w, h } = size(f);
    artboards.push({ file: f, x, y, w, h, ...(page ? { page } : {}) });
    x += Math.max(gap, w + 50);
    tallest = Math.max(tallest, h);
  }
  y += tallest + ROW_GAP;
}

/* ---- Page 1: the app, in the order someone meets it ---- */
row(['Onboarding1.dc.html', 'Onboarding2.dc.html', 'Onboarding3.dc.html', 'NotifyPriming.dc.html'], 'screens');
row(['Main.dc.html', 'TripsEmpty.dc.html', 'TripsLoading.dc.html', 'NewTrip.dc.html', 'EditTrip.dc.html'], 'screens');
row(['TripItinerary.dc.html', 'TripMap.dc.html', 'AddStopSearch.dc.html', 'AddStopConfirm.dc.html', 'AddStopManual.dc.html'], 'screens');
row(['StopToDo.dc.html', 'StopFood.dc.html', 'StopBudget.dc.html', 'StopBudgetOver.dc.html'], 'screens');
row(['Expenses.dc.html', 'ExpensesEmpty.dc.html', 'ExpenseForm.dc.html', 'Dashboard.dc.html'], 'screens');
row(['TripRecap.dc.html', 'Settings.dc.html', 'NotifySettings.dc.html'], 'screens');

/* ---- Page 2: everything that speaks to the user ---- */
y = 0;
row(['PushNotifications.dc.html'], 'messaging');
row(['Toasts.dc.html'], 'messaging');
row(['Banners.dc.html'], 'messaging');
row(['Dialogs.dc.html'], 'messaging');

/* ---- Page 3: theme and the library ---- */
y = 0;
row(['DarkTrips.dc.html', 'DarkItinerary.dc.html'], 'system');
row(['Components.dc.html'], 'system');

const canvas = {
  artboards,
  pages: [
    { id: 'screens', name: 'App screens' },
    { id: 'messaging', name: 'Notifications' },
    { id: 'system', name: 'Dark & components' },
  ],
  annotations: [
    { id: 'first-run', x: 0, y: -66, w: 420, page: 'screens',
      text: 'First run — three panels, then the notification ask AFTER the first trip exists, never on launch.' },
    { id: 'one-trip', x: 1320, y: -66, w: 420, page: 'screens',
      text: 'Every screen shows the same trip: ₹12,550 spent of a ₹15,000 budget, across 9 expenses and 3 stops. The figures are derived from one fixture, so they add up wherever you check them.' },
    { id: 'push-note', x: 0, y: -66, w: 460, page: 'messaging',
      text: 'Every push carries a real figure. None of them scold. Both platforms drawn so the copy can be checked at its real length.' },
    { id: 'dark-note', x: 0, y: -66, w: 440, page: 'system',
      text: 'Dark is re-derived, not inverted. Elevation becomes surface lightness, because shadows vanish on a dark ground. And the blue splits in two: the link tint lifts to #4E86F7 to stay readable on the dark ground, while filled buttons drop to #2F5FD0 so white text on them still clears 4.5:1.' },
  ],
  launch: { view: 'canvas', page: 'screens' },
};

writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log(`canvas.json — ${artboards.length} artboards across ${canvas.pages.length} pages`);

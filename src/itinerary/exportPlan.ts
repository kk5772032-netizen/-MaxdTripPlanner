import { formatDateRange } from '../dates';
import { bookingLabels } from '../tokens';
import type { Activity, Booking, FoodPlan, Stop, Trip } from '../types';
import { dayEntries, formatDayLabel, formatSpan, formatTime, planByDay } from './schedule';

/**
 * The itinerary as something you can send someone.
 *
 * Two renderings of one plan: plain text, which is what actually gets pasted
 * into a WhatsApp thread, and an HTML document that becomes a PDF. Both are
 * pure functions of the trip data — no filesystem, no printer, nothing that
 * needs a device — so what they produce can be asserted on in a test rather
 * than eyeballed in a share sheet.
 *
 * Money is deliberately absent from both. A shared itinerary usually goes to
 * people you are travelling with rather than people you split budgets with,
 * and a plan that leads with what you can afford is the thing this app spent a
 * release moving away from.
 */

export interface PlanData {
  trip: Trip;
  stops: Stop[];
  activities: Activity[];
  foodPlans: FoodPlan[];
  bookings: Booking[];
}

/** A file name someone can find again: "delhi-long-weekend.pdf". */
export function planFileName(trip: Trip, extension: string): string {
  const slug =
    trip.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'trip';
  return `${slug}.${extension}`;
}

/* -------------------------------------------------------------------------- */
/* Shared shaping                                                             */
/* -------------------------------------------------------------------------- */

interface Line {
  /** "6:00 am", or null when the row isn't timed. */
  time: string | null;
  title: string;
  /** Kind for a booking, nothing for a stop. */
  kicker: string | null;
  /** Address, or a booking's location and reference. */
  detail: string | null;
  todo: string[];
  food: string[];
}

function linesForDay(day: ReturnType<typeof planByDay>[number], data: PlanData): Line[] {
  return dayEntries(day).map((entry) => {
    if (entry.kind === 'booking') {
      const { booking, role } = entry;
      return {
        time: formatTime(entry.time),
        title: booking.title,
        kicker: role === 'checkout' ? 'Check out' : bookingLabels[booking.kind],
        detail: [booking.confirmation, role === 'checkout' ? null : booking.location]
          .filter(Boolean)
          .join(' · ') || null,
        todo: [],
        food: [],
      };
    }

    const { stop } = entry;
    return {
      time: formatSpan(stop),
      title: stop.name,
      kicker: null,
      detail: stop.address,
      todo: data.activities.filter((a) => a.stopId === stop.id).map((a) => a.title),
      food: data.foodPlans.filter((f) => f.stopId === stop.id).map((f) => f.name),
    };
  });
}

/** Days in order, with the ones that have nothing on them still present. */
function dayBlocks(data: PlanData) {
  return planByDay(data.trip, data.stops, data.bookings).map((day) => ({
    day,
    lines: linesForDay(day, data),
  }));
}

function dayHeading(day: ReturnType<typeof planByDay>[number]): string {
  if (day.date === null) return 'Not scheduled yet';
  if (day.dayNumber === null) return formatDayLabel(day.date);
  return `Day ${day.dayNumber} — ${formatDayLabel(day.date)}`;
}

/* -------------------------------------------------------------------------- */
/* Plain text                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Deliberately unaligned. Padding times into columns looks right in a
 * monospaced editor and falls apart in every chat app, which is where this
 * text is going.
 */
export function planAsText(data: PlanData): string {
  const out: string[] = [data.trip.name, formatDateRange(data.trip.startDate, data.trip.endDate)];

  for (const { day, lines } of dayBlocks(data)) {
    out.push('', dayHeading(day).toUpperCase());

    if (lines.length === 0) {
      out.push('Nothing planned yet.');
      continue;
    }

    for (const line of lines) {
      const head = [line.time, line.kicker, line.title].filter(Boolean).join(' · ');
      out.push(`• ${head}`);
      if (line.detail) out.push(`  ${line.detail}`);
      if (line.todo.length) out.push(`  To do: ${line.todo.join(', ')}`);
      if (line.food.length) out.push(`  Food: ${line.food.join(', ')}`);
    }
  }

  const undated = data.bookings.filter((b) => !b.startsAt && !b.endsAt);
  if (undated.length > 0) {
    out.push('', 'BOOKED, NO DATE YET');
    for (const b of undated) {
      out.push(
        `• ${[bookingLabels[b.kind], b.title, b.confirmation].filter(Boolean).join(' · ')}`,
      );
    }
  }

  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/* HTML, for the PDF                                                          */
/* -------------------------------------------------------------------------- */

/** Everything below goes through this. A stop named `<b>` is not markup. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function planAsHtml(data: PlanData): string {
  const blocks = dayBlocks(data)
    .map(({ day, lines }) => {
      const rows =
        lines.length === 0
          ? '<p class="empty">Nothing planned yet.</p>'
          : lines
              .map((line) => {
                const sub = [
                  line.detail ? `<div class="detail">${esc(line.detail)}</div>` : '',
                  line.todo.length
                    ? `<div class="sub"><span>To do</span> ${esc(line.todo.join(' · '))}</div>`
                    : '',
                  line.food.length
                    ? `<div class="sub"><span>Food</span> ${esc(line.food.join(' · '))}</div>`
                    : '',
                ].join('');
                return `
        <div class="row">
          <div class="when">${line.time ? esc(line.time) : ''}</div>
          <div class="what">
            ${line.kicker ? `<div class="kicker">${esc(line.kicker)}</div>` : ''}
            <div class="title">${esc(line.title)}</div>
            ${sub}
          </div>
        </div>`;
              })
              .join('');

      return `
      <section class="day">
        <h2>${esc(dayHeading(day))}</h2>
        ${rows}
      </section>`;
    })
    .join('');

  const undated = data.bookings.filter((b) => !b.startsAt && !b.endsAt);
  const appendix =
    undated.length === 0
      ? ''
      : `
      <section class="day">
        <h2>Booked, no date yet</h2>
        ${undated
          .map(
            (b) => `
        <div class="row">
          <div class="when"></div>
          <div class="what">
            <div class="kicker">${esc(bookingLabels[b.kind])}</div>
            <div class="title">${esc(b.title)}</div>
            ${b.confirmation ? `<div class="detail">${esc(b.confirmation)}</div>` : ''}
          </div>
        </div>`,
          )
          .join('')}
      </section>`;

  // Everything is inlined: a PDF is rendered without a network, so a linked
  // stylesheet or webfont would silently produce an unstyled document.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(data.trip.name)}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #0C111D;
    font-size: 11pt;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
  }
  header { border-bottom: 2px solid #0C111D; padding-bottom: 10px; margin-bottom: 4px; }
  h1 { font-size: 22pt; margin: 0; letter-spacing: -0.02em; }
  .dates { color: #475467; font-size: 10.5pt; margin-top: 3px; }

  .day { margin-top: 22px; page-break-inside: avoid; }
  .day h2 {
    font-size: 12pt;
    margin: 0 0 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #E4E7EC;
    letter-spacing: 0.02em;
  }

  .row { display: flex; gap: 14px; padding: 6px 0; page-break-inside: avoid; }
  .when {
    width: 74px;
    flex: none;
    color: #0C111D;
    font-size: 9.5pt;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding-top: 2px;
  }
  .what { flex: 1; min-width: 0; }
  .kicker {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #2563EB;
  }
  .title { font-weight: 600; }
  .detail { color: #475467; font-size: 10pt; }
  .sub { color: #475467; font-size: 10pt; margin-top: 2px; }
  .sub span {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #667085;
    margin-right: 5px;
  }
  .empty { color: #98A2B3; font-size: 10pt; margin: 2px 0 0; }
</style>
</head>
<body>
  <header>
    <h1>${esc(data.trip.name)}</h1>
    <div class="dates">${esc(formatDateRange(data.trip.startDate, data.trip.endDate))}</div>
  </header>
  ${blocks}
  ${appendix}
</body>
</html>`;
}

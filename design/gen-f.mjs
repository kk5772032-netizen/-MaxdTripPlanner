import { writeFileSync } from 'node:fs';
import { C, D, T, ELEV, dc, icon, iconFill, CAT_ICON, FONT } from './lib.mjs';
import * as p from './parts.mjs';
const w = (f, s) => { writeFileSync(f, s); console.log('  ', f); };

/* ---------------- P20 · Trip recap ---------------- */
function slice(cx, cy, ro, ri, a0, a1) {
  const rad = (d) => ((d - 90) * Math.PI) / 180;
  const pt = (r, a) => `${(cx + r * Math.cos(rad(a))).toFixed(2)} ${(cy + r * Math.sin(rad(a))).toFixed(2)}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${pt(ro, a0)} A ${ro} ${ro} 0 ${large} 1 ${pt(ro, a1)} L ${pt(ri, a1)} A ${ri} ${ri} 0 ${large} 0 ${pt(ri, a0)} Z`;
}
function donut(data, size = 150) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const ro = size / 2, ri = ro * 0.58;
  let a = 0, out = '';
  for (const d of data) {
    const sweep = (d.v / total) * 360;
    out += `<path d="${slice(ro, ro, ro, ri, a + 0.75, a + sweep - 0.75)}" fill="${C[d.cat]}"/>`;
    a += sweep;
  }
  return `<svg width="${size}" height="${size}" style="flex:none">${out}</svg>`;
}

const recapStat = (v, l) => `<div style="flex:1;background:${C.surface};border:1px solid ${C.border};border-radius:12px;
  padding:12px;display:flex;flex-direction:column;gap:2px;${ELEV.sm}">
  <span style="${T.heading};color:${C.text};font-variant-numeric:tabular-nums">${v}</span>
  <span style="${T.captionS};color:${C.muted}">${l}</span></div>`;

const byStop = (name, actual, cap, pctW, status) => `
<div style="display:flex;flex-direction:column;gap:5px">
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <span style="${T.label};color:${C.text}">${name}</span>
    <span style="${T.caption};color:${C.muted};font-variant-numeric:tabular-nums">${actual} of ${cap}</span></div>
  <div style="height:6px;border-radius:3px;background:${C.sunken};overflow:hidden">
    <div style="height:100%;width:${pctW}%;background:${C[status]};border-radius:3px"></div></div>
</div>`;

w('TripRecap.dc.html', dc(`
<div style="flex:none;background:${C.primary};padding:16px 20px 28px;border-radius:0 0 20px 20px;
  display:flex;flex-direction:column;gap:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    ${icon('close', 22, '#fff', 2)}
    <span style="${T.bodyS};color:#fff">Delhi weekend</span>
    ${icon('share', 20, '#fff', 2)}
  </div>
  <span style="font-size:12px;line-height:16px;font-weight:600;letter-spacing:.08em;color:rgba(255,255,255,.7)">4–7 NOV 2025</span>
  <span style="${T.display};color:#fff;text-wrap:balance">You came in ₹2,350 under.</span>
  <span style="${T.body};color:rgba(255,255,255,.82)">₹12,650 spent of a ₹15,000 budget.</span>
</div>
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  <div style="display:flex;gap:12px">${recapStat('3', 'stops')}${recapStat('18', 'expenses')}${recapStat('₹4,216', 'a day')}</div>
  ${p.card(`<span style="${T.heading};color:${C.text}">Where the money went</span>
    <div style="display:flex;align-items:center;gap:16px">
      ${donut([{ cat: 'food', v: 4600 }, { cat: 'transport', v: 3800 }, { cat: 'lodging', v: 2600 }, { cat: 'activity', v: 1650 }])}
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        ${[['food', 'Food', '₹4,600'], ['transport', 'Transport', '₹3,800'], ['lodging', 'Lodging', '₹2,600'], ['activity', 'Activity', '₹1,650']]
          .map(([c, l, v]) => `<div style="display:flex;align-items:center;gap:8px">
            <div style="width:10px;height:10px;border-radius:3px;background:${C[c]}"></div>
            <span style="flex:1;${T.caption};color:${C.text}">${l}</span>
            <span style="${T.captionS};color:${C.text};font-variant-numeric:tabular-nums">${v}</span></div>`).join('')}
      </div></div>`)}
  ${p.card(`<span style="${T.label};color:${C.muted}">Biggest single expense</span>
    <div style="display:flex;align-items:center;gap:12px">
      ${p.catTile('transport', { size: 38 })}
      <div style="flex:1;display:flex;flex-direction:column;gap:1px">
        <span style="${T.bodyS};color:${C.text}">Flights to Delhi</span>
        <span style="${T.caption};color:${C.muted}">Whole trip · 2 Nov</span></div>
      <span style="${T.amount};color:${C.text}">₹8,000.00</span></div>`, { gap: 10 })}
  ${p.card(`<span style="${T.heading};color:${C.text}">By stop</span>
    ${byStop('India Gate', '₹2,850', '₹3,000', 95, 'near')}
    ${byStop("Humayun's Tomb", '₹1,900', '₹2,200', 86, 'near')}
    ${byStop('Connaught Place', '₹4,300', '₹3,500', 100, 'over')}`, { gap: 14 })}
  ${p.button('Plan a trip like this', { variant: 'secondary', ic: 'plus' })}
</div>
`, { h: 1060 }));

/* ---------------- N01 · Push notifications ---------------- */
const appMark = (size = 38) => `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.26}px;
  background:${C.primary};display:flex;align-items:center;justify-content:center;flex:none">
  <svg width="${size * 0.62}" height="${size * 0.62}" viewBox="0 0 24 24" fill="none">
    <path d="M3.5 19.5 L10 14 L16 8.5" stroke="#fff" stroke-width="1.6" stroke-dasharray="2.6 2.4" stroke-linecap="round" opacity=".75"/>
    <circle cx="3.6" cy="19.6" r="2.1" fill="#fff"/><circle cx="10" cy="14" r="2.1" fill="#fff"/>
    <path d="M17 3.4a4.3 4.3 0 0 1 4.3 4.3c0 3-4.3 6.6-4.3 6.6s-4.3-3.6-4.3-6.6A4.3 4.3 0 0 1 17 3.4Z" fill="#fff"/>
    <circle cx="17" cy="7.6" r="1.7" fill="${C.primary}"/>
  </svg></div>`;

const iosNotif = (title, body, actions) => `
<div style="background:rgba(255,255,255,.86);backdrop-filter:blur(20px);border-radius:18px;padding:12px 14px;
  display:flex;flex-direction:column;gap:8px;${ELEV.md}">
  <div style="display:flex;gap:10px;align-items:flex-start">
    ${appMark(38)}
    <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="${T.bodyS};color:${C.text}">${title}</span>
        <span style="${T.caption};color:${C.faint}">now</span></div>
      <span style="${T.caption};color:${C.muted};line-height:17px">${body}</span>
    </div></div>
  ${actions.length ? `<div style="display:flex;gap:8px;padding-left:48px">
    ${actions.map((a) => `<div style="padding:6px 12px;border-radius:999px;background:rgba(12,17,29,.06)">
      <span style="${T.captionS};color:${C.text}">${a}</span></div>`).join('')}</div>` : ''}
</div>`;

const androidNotif = (title, body, actions) => `
<div style="background:${C.surface};border-radius:24px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;${ELEV.sm}">
  <div style="display:flex;align-items:center;gap:8px">
    <div style="width:18px;height:18px;border-radius:5px;background:${C.primary};flex:none"></div>
    <span style="${T.caption};color:${C.muted}">Waypoint</span>
    <span style="${T.caption};color:${C.faint}">· now</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:3px">
    <span style="${T.bodyS};color:${C.text}">${title}</span>
    <span style="${T.caption};color:${C.muted};line-height:17px">${body}</span>
  </div>
  ${actions.length ? `<div style="display:flex;gap:18px;padding-top:2px">
    ${actions.map((a) => `<span style="${T.label};color:${C.primary};text-transform:uppercase;letter-spacing:.02em">${a}</span>`).join('')}
  </div>` : ''}
</div>`;

const NOTIFS = [
  ['Connaught Place is at 85%', '₹2,975 of ₹3,500 spent. ₹525 left at this stop.', ['Log expense', 'View stop']],
  ['Delhi weekend is over budget', "₹15,840 spent of ₹15,000. You're ₹840 over.", ['See dashboard']],
  ['Log today’s spending', "Day 2 of Delhi weekend. You've logged ₹1,200 so far today.", ['Add expense', 'Nothing today']],
  ['Delhi weekend starts tomorrow', '3 stops planned, ₹15,000 budget. 2 stops still have no budget set.', ['Review trip']],
  ['How did Delhi weekend go?', 'You came in ₹2,350 under budget. See the recap.', ['See recap']],
];

const colHead = (t) => `<span style="${T.label};color:${C.muted};letter-spacing:.06em;text-transform:uppercase">${t}</span>`;

w('PushNotifications.dc.html', dc(`
<div style="padding:32px;display:flex;flex-direction:column;gap:24px;overflow:hidden">
  <div style="display:flex;flex-direction:column;gap:6px">
    <span style="${T.title};color:${C.text}">Push notifications</span>
    <span style="${T.body};color:${C.muted};max-width:640px;text-wrap:pretty">Every push carries a real number —
      one with no figure gets swiped away. None of them scold: "You're ₹840 over" is a fact.</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 32px">
    <div style="display:flex;flex-direction:column;gap:12px">${colHead('iOS')}
      ${NOTIFS.map((n) => iosNotif(...n)).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:12px">${colHead('Android')}
      ${NOTIFS.map((n) => androidNotif(...n)).join('')}</div>
  </div>
</div>`, { w: 880, h: 1120, bg: '#E9EDF2' }));

/* ---------------- N02 · Toasts ---------------- */
const toast = (ic, text, action, { timer, danger } = {}) => `
<div style="background:rgba(12,17,29,.96);border-radius:12px;padding:14px 16px;display:flex;align-items:center;
  gap:12px;${ELEV.lg};position:relative;overflow:hidden">
  ${icon(ic, 20, danger ? C.over : '#fff')}
  <span style="flex:1;${T.body};color:#fff">${text}</span>
  ${action ? `<span style="${T.bodyS};color:#93B4FD">${action}</span>` : ''}
  ${timer ? `<div style="position:absolute;left:0;bottom:0;height:2px;width:62%;background:#93B4FD;opacity:.7"></div>` : ''}
</div>`;

const ruleLine = (t) => `<div style="display:flex;gap:10px;align-items:flex-start">
  <div style="width:5px;height:5px;border-radius:3px;background:${C.primary};margin-top:8px;flex:none"></div>
  <span style="${T.body};color:${C.muted};text-wrap:pretty">${t}</span></div>`;

w('Toasts.dc.html', dc(`
<div style="padding:32px;display:flex;flex-direction:column;gap:24px;overflow:hidden">
  <div style="display:flex;flex-direction:column;gap:6px">
    <span style="${T.title};color:${C.text}">Toasts</span>
    <span style="${T.body};color:${C.muted};max-width:620px">Anything destructive gets an Undo toast instead of a
      pre-emptive dialog — except deleting a whole trip, which keeps its confirmation.</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px">
    <div style="display:flex;flex-direction:column;gap:14px">
      ${colHead('Variants')}
      ${toast('check', 'Expense added')}
      ${toast('trash', 'Expense deleted', 'Undo', { timer: true })}
      ${toast('trash', 'Stop removed', 'Undo', { timer: true })}
      ${toast('cloudOff', "You're offline. Changes are saved on your phone.")}
      ${toast('alert', "Couldn't reach Google Places", 'Retry', { danger: true })}
    </div>
    <div style="display:flex;flex-direction:column;gap:14px">
      ${colHead('Rules')}
      ${ruleLine('One at a time — a new toast replaces the old rather than stacking.')}
      ${ruleLine('Destructive actions get Undo, not a confirmation dialog.')}
      ${ruleLine('Never covers the primary action of the screen beneath.')}
      ${ruleLine('4 seconds by default, 6 when there is an action to take.')}
      ${ruleLine('Sits 16pt above the safe area, or above a sticky bar when one is present.')}
    </div>
  </div>
</div>`, { w: 880, h: 560, bg: '#E9EDF2' }));

/* ---------------- N03 · Banners ---------------- */
w('Banners.dc.html', dc(`
<div style="padding:32px;display:flex;flex-direction:column;gap:24px;overflow:hidden">
  <div style="display:flex;flex-direction:column;gap:6px">
    <span style="${T.title};color:${C.text}">Inline notices</span>
    <span style="${T.body};color:${C.muted};max-width:620px">A notice never contains a spinner, and never runs past
      four lines. Persistent state pushes content down; it does not overlay it.</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px">
    <div style="display:flex;flex-direction:column;gap:12px">${colHead('Info')}
      ${p.notice('Set a Google Places key to search real places. You can still add stops by typing them below.',
        { ic: 'search', title: 'Place search is off' })}
      ${p.notice('Waypoint stores everything on this device.', { ic: 'lock', title: 'Nothing leaves your phone' })}
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">${colHead('Warning')}
      ${p.notice('Connaught Place is over its budget.', { tone: 'warning' })}
      ${p.notice('Your plan already costs more than the trip budget.', { tone: 'warning' })}
      ${p.notice("Showing a cached list — couldn't reach Google just now.", { tone: 'warning' })}
      ${p.notice('This trip is close to its total budget.', { tone: 'warning' })}
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">${colHead('Danger')}
      ${p.notice('no such table: trips', { tone: 'danger', title: "Couldn't load your trips" })}
      ${p.notice('Check your connection and try Refresh.', { tone: 'danger', title: "Couldn't load restaurants" })}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">${colHead('Persistent offline bar')}
    <div style="width:390px;border:1px solid ${C.border};border-radius:12px;overflow:hidden;background:${C.surface}">
      <div style="padding:14px 16px;border-bottom:1px solid ${C.border};display:flex;align-items:center;gap:12px">
        ${icon('back', 22, C.primary, 2)}<span style="${T.heading};color:${C.text}">Delhi weekend</span></div>
      <div style="height:32px;background:${C.nearSoft};display:flex;align-items:center;gap:8px;padding:0 16px">
        ${icon('cloudOff', 15, C.near)}<span style="${T.captionS};color:${C.near}">Offline — showing saved data</span></div>
      <div style="height:44px"></div>
    </div>
  </div>
</div>`, { w: 1080, h: 720, bg: '#E9EDF2' }));

/* ---------------- N04 · Dialogs ---------------- */
const dialog = (title, body, cancel, confirm) => `
<div style="background:${C.surface};border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:8px;${ELEV.lg}">
  <span style="${T.heading};color:${C.text}">${title}</span>
  <span style="${T.body};color:${C.muted};text-wrap:pretty">${body}</span>
  <div style="display:flex;justify-content:flex-end;gap:20px;margin-top:12px">
    <span style="${T.body};color:${C.muted}">${cancel}</span>
    <span style="${T.bodyS};color:${C.over}">${confirm}</span></div>
</div>`;

w('Dialogs.dc.html', dc(`
<div style="padding:32px;display:flex;flex-direction:column;gap:24px;overflow:hidden">
  <div style="display:flex;flex-direction:column;gap:6px">
    <span style="${T.title};color:${C.text}">Dialogs</span>
    <span style="${T.body};color:${C.muted};max-width:660px;text-wrap:pretty">Only for actions that cannot be undone.
      Note the second one: telling people what is <em>preserved</em> matters as much as what is lost.</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px">
    ${dialog('Delete trip?', 'Delhi weekend and everything in it — stops, activities, food plans and expenses — will be removed.', 'Cancel', 'Delete')}
    ${dialog('Remove stop?', 'India Gate, its activities and its food plan will be removed. Expenses logged against it are kept as trip-level expenses.', 'Cancel', 'Remove')}
    ${dialog('Delete all data?', "Every trip, stop and expense on this device will be removed. This can't be undone.", 'Cancel', 'Delete everything')}
  </div>
</div>`, { w: 1080, h: 420, bg: '#E9EDF2' }));

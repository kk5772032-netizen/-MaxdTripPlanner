import { writeFileSync } from 'node:fs';
import { C, D, T, ELEV, dc, icon, iconFill, CAT_ICON } from './lib.mjs';
import * as p from './parts.mjs';
import { TOTALS, TRIP, money, stopRows } from './data.mjs';
const w = (f, s) => { writeFileSync(f, s); console.log('  ', f); };

/* Dark elevation is surface lightness, not shadow — shadows are invisible here. */
const DE = 'box-shadow:none';

/* ---------------- X01 · Dark: trips list ---------------- */
const dTripCard = (name, dates, stops, spend, pct, status, badgeText) => `
<div style="background:${D.surface};border:1px solid ${D.border};border-radius:16px;padding:16px;
  display:flex;flex-direction:column;gap:12px;${DE}">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">
      <span style="${T.heading};color:${D.text}">${name}</span>
      <div style="display:flex;align-items:center;gap:4px">${icon('calendar', 13, D.faint)}
        <span style="${T.caption};color:${D.muted}">${dates}</span></div>
      <div style="display:flex;align-items:center;gap:4px">${icon('location', 13, D.faint)}
        <span style="${T.caption};color:${D.muted}">${stops}</span></div>
    </div>
    ${p.budgetRing(pct, status, { t: D })}
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid ${D.border};padding-top:12px">
    <span style="${T.label};color:${D.text};font-variant-numeric:tabular-nums">${spend}</span>
    ${badgeText ? `<div style="padding:3px 8px;border-radius:999px;background:${D[status + 'Soft']}">
      <span style="${T.captionS};color:${D[status + 'Text']}">${badgeText}</span></div>`
      : `<span style="${T.caption};color:${D.faint}">No budget set</span>`}
  </div></div>`;

w('DarkTrips.dc.html', dc(`
${p.header('Trips', { back: false, big: true, t: D })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
  ${dTripCard(TRIP.name, `${TRIP.dates} · 4d`, '3 stops',
    `${money(TOTALS.actual)} of ${money(TOTALS.budget)}`, TOTALS.percent, TOTALS.status, 'Close to cap')}
  ${dTripCard('Kerala backwaters', '2–9 Dec 2026 · 8d', '5 stops', '₹14,200 of ₹42,000', 34, 'under', 'On track')}
  ${dTripCard('Tokyo, spring', '28 Mar–4 Apr 2027 · 8d', '6 stops', '¥212,400 of ¥180,000', 118, 'over', 'Over budget')}
  ${dTripCard('Someday: Patagonia', 'No dates set', '2 stops', '₹0 spent', 0, 'unset', null)}
</div>
<div style="position:absolute;right:16px;bottom:${24 + p.INSET}px;width:58px;height:58px;border-radius:29px;
  background:${D.accent};display:flex;align-items:center;justify-content:center">${icon('plus', 26, D.onPrimary, 2.2)}</div>
<div style="position:absolute;left:0;right:0;bottom:0;background:${D.surface};border-top:1px solid ${D.border};
  padding:8px 0 ${8 + p.INSET}px;display:flex;justify-content:center">
  <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
    ${icon('map', 24, D.primary, 2)}<span style="${T.captionS};color:${D.primary}">Trips</span></div></div>
`, { bg: D.bg, fg: D.text }));

/* ---------------- X01 · Dark: itinerary ---------------- */
const dStop = (n, name, addr, meta, actual, cap, status, note) => `
<div style="background:${D.surface};border:1px solid ${D.border};border-radius:16px;padding:16px">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="width:28px;height:28px;border-radius:14px;background:${D.primarySoft};display:flex;
      align-items:center;justify-content:center;flex:none">
      <span style="${T.captionS};color:${D.primary}">${n}</span></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0">
      <span style="${T.bodyS};color:${D.text}">${name}</span>
      <span style="${T.caption};color:${D.muted}">${addr}</span>
      <span style="${T.caption};color:${D.faint};margin-top:2px">${meta}</span></div>
    ${icon('reorder', 22, D.faint)}
  </div>
  <div style="margin-top:12px">${p.budgetBar(actual, cap, status, { compact: true, note, t: D })}</div>
</div>`;

w('DarkItinerary.dc.html', dc(`
${p.header(TRIP.name, { right: p.headerAction('Edit', 'edit', { t: D }), t: D })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
  <div style="display:flex;align-items:center;gap:4px">${icon('calendar', 14, D.faint)}
    <span style="${T.caption};color:${D.muted}">${TRIP.dates}</span></div>
  ${p.segmented([{ label: 'Itinerary', ic: 'list', on: true }, { label: 'Map', ic: 'map' }], { t: D })}
  ${p.notice(`${stopRows.find((s) => s.status === 'over').name} is over its budget.`, { tone: 'warning', t: D })}
  ${stopRows.map((s) => {
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    return dStop(s.n, s.name, s.address,
      `${plural(s.activities.length, 'activity', 'activities')} · ${plural(s.food.length, 'food spot', 'food spots')}`,
      money(s.actual), money(s.cap), s.status,
      s.actual > s.cap ? `${money(s.actual - s.cap)} over budget` : undefined);
  }).join('\n  ')}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;background:${D.surface};border-top:1px solid ${D.border};
  padding:12px 16px ${12 + p.INSET}px;display:flex;flex-direction:column;gap:8px">
  ${p.budgetBar(money(TOTALS.actual), money(TOTALS.budget), TOTALS.status, { label: 'Trip total', planned: TOTALS.planned, t: D })}
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;align-items:center;gap:5px">${icon('receipt', 15, D.primary)}
      <span style="${T.label};color:${D.primary}">${TOTALS.count} expenses</span></div>
    <div style="display:flex;align-items:center;gap:5px">
      <span style="${T.label};color:${D.primary};font-variant-numeric:tabular-nums">${money(TOTALS.remaining)} left</span>
      ${icon('chart', 15, D.primary)}</div></div></div>
`, { bg: D.bg, fg: D.text }));

/* ---------------- X04 · Component sheet ---------------- */
const spec = (label, el) => `<div style="display:flex;flex-direction:column;gap:8px">
  <span style="font-size:11px;line-height:15px;font-weight:600;letter-spacing:.05em;color:${C.faint};
    text-transform:uppercase">${label}</span>${el}</div>`;

const group = (title, inner, cols = 4) => `
<div style="display:flex;flex-direction:column;gap:14px">
  <span style="${T.heading};color:${C.text};border-bottom:1px solid ${C.border};padding-bottom:8px">${title}</span>
  <div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:20px">${inner}</div>
</div>`;

const [IG, HT, CP] = [stopRows[0], stopRows[1], stopRows[2]];

const swatch = (name, hex) => `<div style="display:flex;flex-direction:column;gap:6px">
  <div style="height:44px;border-radius:10px;background:${hex};border:1px solid rgba(12,17,29,.08)"></div>
  <span style="${T.captionS};color:${C.text}">${name}</span>
  <span style="font-size:11px;color:${C.faint};font-variant-numeric:tabular-nums">${hex}</span></div>`;

w('Components.dc.html', dc(`
<div style="padding:36px;display:flex;flex-direction:column;gap:32px;overflow:hidden">
  <div style="display:flex;flex-direction:column;gap:6px">
    <span style="${T.title};color:${C.text}">Component sheet</span>
    <span style="${T.body};color:${C.muted}">Every specimen carries its state. Values are the app's own tokens.</span>
  </div>

  ${group('Buttons', [
    spec('primary', p.button('Add stop', { ic: 'plus' })),
    spec('secondary', p.button('View expenses', { variant: 'secondary', ic: 'receipt' })),
    spec('danger', p.button('Remove stop', { variant: 'danger', ic: 'trash' })),
    spec('disabled', `<div style="opacity:.45">${p.button('Create trip', { ic: 'plus' })}</div>`),
  ].join(''))}

  ${group('Chips', [
    spec('outline', `<div style="display:flex;gap:8px;flex-wrap:wrap">${p.chip('INR')}${p.chip('USD')}</div>`),
    spec('selected', `<div style="display:flex;gap:8px;flex-wrap:wrap">${p.chip('INR', { on: true })}${p.chip('All', { on: true })}</div>`),
    spec('category', `<div style="display:flex;gap:8px;flex-wrap:wrap">
      ${p.chip('Food', { ic: CAT_ICON.food, color: C.food, on: true })}
      ${p.chip('Transport', { ic: CAT_ICON.transport, color: C.transport, on: true })}</div>`),
    spec('with icon', `<div style="display:flex;gap:8px;flex-wrap:wrap">
      ${p.chip('Whole trip', { ic: 'globe' })}${p.chip('India Gate', { ic: 'location', on: true })}</div>`),
  ].join(''))}

  ${group('Budget bar', [
    spec('under', p.budgetBar(money(CP.actual), money(CP.cap), CP.status, { label: CP.name, planned: CP.planned })),
    spec('near', p.budgetBar(money(IG.actual), money(IG.cap), IG.status, { label: IG.name, planned: IG.planned })),
    spec('over', p.budgetBar(money(HT.actual), money(HT.cap), HT.status,
      { label: HT.name, note: `${money(HT.actual - HT.cap)} over budget` })),
    spec('no cap', p.budgetBar(money(CP.actual), null, 'unset', { label: 'Stop' })),
  ].join(''))}

  ${group('Budget ring', [
    spec('62%', p.budgetRing(62, 'under')), spec(`${TOTALS.percent}%`, p.budgetRing(TOTALS.percent, 'near')),
    spec('115%', p.budgetRing(115, 'over')), spec('no budget', p.budgetRing(0, 'unset')),
  ].join(''))}

  ${group('Inputs', [
    spec('rest', p.input('', { placeholder: 'Delhi long weekend' })),
    spec('focus', p.input(TRIP.name, { focus: true })),
    spec('amount', p.input(String(TRIP.budget), { prefix: '₹' })),
    spec('multiline', p.input('', { placeholder: 'Best at sunset', multiline: true })),
  ].join(''))}

  ${group('Notices', [
    spec('info', p.notice('Set a Places key to search real places.', { title: 'Place search is off', ic: 'search' })),
    spec('warning', p.notice(`${HT.name} is over its budget.`, { tone: 'warning' })),
    spec('danger', p.notice('Check your connection.', { tone: 'danger', title: "Couldn't load restaurants" })),
  ].join(''), 3)}

  ${group('Category tiles', ['food', 'activity', 'transport', 'lodging', 'other']
    .map((c) => spec(c, p.catTile(c, { size: 38 }))).join(''), 5)}

  ${group('Surfaces & brand', [
    swatch('bg', C.bg), swatch('surface', C.surface), swatch('sunken', C.sunken),
    swatch('raised', C.raised), swatch('border', C.border), swatch('primary', C.primary),
  ].join(''), 6)}

  ${group('Fill vs. tint', [
    swatch('primary (tint)', C.primary), swatch('accent (fill)', C.accent),
    swatch('accent pressed', C.accentPressed), swatch('danger fill', C.dangerFill),
    swatch('primary soft', C.primarySoft), swatch('on dark accent', C.onDarkAccent),
  ].join(''), 6)}

  ${group('Status: fill above, text below', [
    swatch('under', C.under), swatch('near', C.near), swatch('over', C.over),
    swatch('under text', C.underText), swatch('near text', C.nearText), swatch('over text', C.overText),
  ].join(''), 3)}

  ${group('Categories', [
    swatch('food', C.food), swatch('activity', C.activity), swatch('transport', C.transport),
    swatch('lodging', C.lodging), swatch('other', C.other),
  ].join(''), 5)}

  ${group('Dark', [
    swatch('bg', D.bg), swatch('surface', D.surface), swatch('sunken', D.sunken),
    swatch('raised', D.raised), swatch('primary (tint)', D.primary), swatch('accent (fill)', D.accent),
  ].join(''), 6)}
</div>`, { w: 1240, h: 1560, bg: '#F1F4F7' }));

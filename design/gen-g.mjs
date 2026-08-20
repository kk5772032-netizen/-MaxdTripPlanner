import { writeFileSync } from 'node:fs';
import { C, D, T, ELEV, dc, icon, iconFill, CAT_ICON } from './lib.mjs';
import * as p from './parts.mjs';
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
      <span style="${T.captionS};color:${D[status]}">${badgeText}</span></div>`
      : `<span style="${T.caption};color:${D.faint}">No budget set</span>`}
  </div></div>`;

w('DarkTrips.dc.html', dc(`
${p.header('Trips', { back: false, big: true, t: D })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
  ${dTripCard('Delhi weekend', '4–7 Nov 2025 · 4d', '3 stops', '₹12,500 of ₹15,000', 83, 'near', 'Close to cap')}
  ${dTripCard('Kerala backwaters', '2–9 Dec 2025 · 8d', '5 stops', '₹14,200 of ₹42,000', 34, 'under', 'On track')}
  ${dTripCard('Tokyo, spring', '28 Mar–4 Apr 2026 · 8d', '6 stops', '¥212,400 of ¥180,000', 118, 'over', 'Over budget')}
  ${dTripCard('Someday: Patagonia', 'No dates set', '2 stops', '₹0 spent', 0, 'unset', null)}
</div>
<div style="position:absolute;right:16px;bottom:${24 + p.INSET}px;width:58px;height:58px;border-radius:29px;
  background:${D.primary};display:flex;align-items:center;justify-content:center">${icon('plus', 26, '#fff', 2.2)}</div>
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
${p.header('Delhi weekend', { right: p.headerAction('Edit', 'edit', { t: D }), t: D })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
  <div style="display:flex;align-items:center;gap:4px">${icon('calendar', 14, D.faint)}
    <span style="${T.caption};color:${D.muted}">4–7 Nov 2025</span></div>
  ${p.segmented([{ label: 'Itinerary', ic: 'list', on: true }, { label: 'Map', ic: 'map' }], { t: D })}
  ${p.notice('Connaught Place is over its budget.', { tone: 'warning', t: D })}
  ${dStop(1, 'India Gate', 'Kartavya Path, New Delhi', '2 activities · 3 food spots', '₹450', '₹3,000', 'under')}
  ${dStop(2, "Humayun's Tomb", 'Mathura Road, Nizamuddin', '1 activity · 2 food spots', '₹1,900', '₹2,200', 'near')}
  ${dStop(3, 'Connaught Place', 'Rajiv Chowk, New Delhi', '3 activities · 4 food spots', '₹4,300', '₹3,500', 'over', '₹800 over budget')}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;background:${D.surface};border-top:1px solid ${D.border};
  padding:12px 16px ${12 + p.INSET}px;display:flex;flex-direction:column;gap:8px">
  ${p.budgetBar('₹6,650', '₹15,000', 'near', { label: 'Trip total', planned: 9200, t: D })}
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;align-items:center;gap:5px">${icon('receipt', 15, D.primary)}
      <span style="${T.label};color:${D.primary}">12 expenses</span></div>
    <div style="display:flex;align-items:center;gap:5px">
      <span style="${T.label};color:${D.primary};font-variant-numeric:tabular-nums">₹8,350 left</span>
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
    spec('under', p.budgetBar('₹450', '₹3,000', 'under', { label: 'Stop', planned: 1400 })),
    spec('near', p.budgetBar('₹1,900', '₹2,200', 'near', { label: 'Stop', planned: 1600 })),
    spec('over', p.budgetBar('₹4,300', '₹3,500', 'over', { label: 'Stop', note: '₹800 over budget' })),
    spec('no cap', p.budgetBar('₹450', null, 'unset', { label: 'Stop' })),
  ].join(''))}

  ${group('Budget ring', [
    spec('34%', p.budgetRing(34, 'under')), spec('83%', p.budgetRing(83, 'near')),
    spec('118%', p.budgetRing(118, 'over')), spec('no budget', p.budgetRing(0, 'unset')),
  ].join(''))}

  ${group('Inputs', [
    spec('rest', p.input('', { placeholder: 'Delhi long weekend' })),
    spec('focus', p.input('Delhi weekend', { focus: true })),
    spec('amount', p.input('15000', { prefix: '₹' })),
    spec('multiline', p.input('', { placeholder: 'Best at sunset', multiline: true })),
  ].join(''))}

  ${group('Notices', [
    spec('info', p.notice('Set a Places key to search real places.', { title: 'Place search is off', ic: 'search' })),
    spec('warning', p.notice('Connaught Place is over its budget.', { tone: 'warning' })),
    spec('danger', p.notice('Check your connection.', { tone: 'danger', title: "Couldn't load restaurants" })),
  ].join(''), 3)}

  ${group('Category tiles', ['food', 'activity', 'transport', 'lodging', 'other']
    .map((c) => spec(c, p.catTile(c, { size: 38 }))).join(''), 5)}

  ${group('Surfaces & brand', [
    swatch('bg', C.bg), swatch('surface', C.surface), swatch('sunken', C.sunken),
    swatch('border', C.border), swatch('primary', C.primary), swatch('primary soft', C.primarySoft),
  ].join(''), 6)}

  ${group('Status & categories', [
    swatch('under', C.under), swatch('near', C.near), swatch('over', C.over),
    swatch('food', C.food), swatch('activity', C.activity), swatch('transport', C.transport),
    swatch('lodging', C.lodging), swatch('other', C.other),
  ].join(''), 8)}
</div>`, { w: 1240, h: 1560, bg: '#F1F4F7' }));

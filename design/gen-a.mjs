import { writeFileSync } from 'node:fs';
import { C, T, ELEV, dc, icon, iconFill } from './lib.mjs';
import * as p from './parts.mjs';

const w = (f, s) => { writeFileSync(f, s); console.log('  ', f); };

/* ---------------- P03 · Trips list (entry artboard) ---------------- */
const tripCard = (name, dates, stops, spend, pct, status, badge) => `
<div style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:16px;
  display:flex;flex-direction:column;gap:12px;${ELEV.sm}">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0">
      <span style="${T.heading};color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span>
      <div style="display:flex;align-items:center;gap:4px">${icon('calendar', 13, C.faint)}
        <span style="${T.caption};color:${C.muted}">${dates}</span></div>
      <div style="display:flex;align-items:center;gap:4px">${icon('location', 13, C.faint)}
        <span style="${T.caption};color:${C.muted}">${stops}</span></div>
    </div>
    ${p.budgetRing(pct, status)}
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;
    border-top:1px solid ${C.border};padding-top:12px">
    <span style="${T.label};color:${C.text};font-variant-numeric:tabular-nums">${spend}</span>
    ${badge}
  </div>
</div>`;

const badge = (text, status) => `<div style="padding:3px 8px;border-radius:999px;background:${C[status + 'Soft']}">
  <span style="${T.captionS};color:${C[status]}">${text}</span></div>`;
const noBudget = `<span style="${T.caption};color:${C.faint}">No budget set</span>`;

w('Main.dc.html', dc(`
${p.header('Trips', { back: false, big: true })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
  ${tripCard('Delhi weekend', '4–7 Nov 2025 · 4d', '3 stops', '₹12,500 of ₹15,000', 83, 'near', badge('Close to cap', 'near'))}
  ${tripCard('Kerala backwaters', '2–9 Dec 2025 · 8d', '5 stops', '₹14,200 of ₹42,000', 34, 'under', badge('On track', 'under'))}
  ${tripCard('Tokyo, spring', '28 Mar–4 Apr 2026 · 8d', '6 stops', '¥212,400 of ¥180,000', 118, 'over', badge('Over budget', 'over'))}
  ${tripCard('Someday: Patagonia', 'No dates set', '2 stops', '₹0 spent', 0, 'unset', noBudget)}
</div>
${p.fab({ bottom: 24 + p.INSET })}
${p.tabBar()}
`));

/* ---------------- P04 · Trips list, empty ---------------- */
w('TripsEmpty.dc.html', dc(`
${p.header('Trips', { back: false, big: true })}
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 16px">
  ${p.emptyState('map', 'No trips yet',
    'Plan a trip as a sequence of stops — what to do, where to eat, and what it should cost.',
    p.button('Create your first trip', { ic: 'plus' }))}
</div>
${p.tabBar()}
`));

/* ---------------- P04 · Trips list, loading ---------------- */
const skel = () => `<div style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;
  padding:16px;display:flex;align-items:center;gap:12px;${ELEV.sm}">
  <div style="flex:1;display:flex;flex-direction:column;gap:8px">
    <div style="height:12px;width:55%;border-radius:6px;background:${C.sunken}"></div>
    <div style="height:10px;width:35%;border-radius:6px;background:${C.sunken}"></div>
  </div>
  <div style="width:44px;height:44px;border-radius:22px;background:${C.sunken}"></div>
</div>`;

w('TripsLoading.dc.html', dc(`
${p.header('Trips', { back: false, big: true })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px">
  ${skel()}${skel()}${skel()}
</div>
${p.tabBar()}
`));

/* ---------------- P05 · Create trip ---------------- */
const dateBox = (cap, val, active) => `<div style="flex:1;background:${C.surface};
  border:1px solid ${active ? C.primary : C.border};border-radius:12px;padding:12px;
  display:flex;flex-direction:column;gap:2px">
  <span style="${T.caption};color:${C.muted}">${cap}</span>
  <span style="${T.body};font-weight:500;color:${val === 'Not set' ? C.faint : C.text}">${val}</span></div>`;

const cal = () => {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  let cells = '';
  for (let i = 0; i < 30; i++) {
    const n = i - 2;
    const sel = n === 4;
    cells += `<div style="height:30px;display:flex;align-items:center;justify-content:center;
      border-radius:15px;${sel ? `background:${C.primary}` : ''}">
      <span style="${T.caption};color:${sel ? '#fff' : n < 1 ? C.faint : C.text};font-variant-numeric:tabular-nums">${n < 1 ? '' : n}</span></div>`;
  }
  return `<div style="margin-top:12px;background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:12px">
    <div style="${T.label};color:${C.text};text-align:center;margin-bottom:8px">November 2025</div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px">
      ${days.map((d) => `<div style="height:20px;display:flex;align-items:center;justify-content:center">
        <span style="${T.caption};color:${C.faint}">${d}</span></div>`).join('')}
      ${cells}
    </div></div>`;
};

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'THB'];

w('NewTrip.dc.html', dc(`
<div style="flex:none;background:${C.surface};border-bottom:1px solid ${C.border};padding:14px 16px;
  display:flex;align-items:center;min-height:56px">
  <span style="${T.body};color:${C.primary};width:64px">Cancel</span>
  <div style="flex:1;${T.heading};color:${C.text};text-align:center">New trip</div>
  <div style="width:64px"></div>
</div>
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:20px;overflow:hidden">
  ${p.field('Trip name', p.input('Delhi long weekend', { focus: true }))}
  ${p.field('Dates', `<div style="display:flex;gap:12px">${dateBox('Start', '4 Nov 2025', true)}${dateBox('End', 'Not set')}</div>${cal()}`)}
  ${p.field('Currency', `<div style="display:flex;flex-wrap:wrap;gap:8px">
    ${CURRENCIES.map((c) => p.chip(c, { on: c === 'INR' })).join('')}</div>`)}
</div>
`));

/* ---------------- P06 · Edit trip ---------------- */
w('EditTrip.dc.html', dc(`
<div style="flex:none;background:${C.surface};border-bottom:1px solid ${C.border};padding:14px 16px;
  display:flex;align-items:center;min-height:56px">
  <span style="${T.body};color:${C.primary};width:64px">Cancel</span>
  <div style="flex:1;${T.heading};color:${C.text};text-align:center">Edit trip</div>
  <div style="width:64px"></div>
</div>
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:20px;overflow:hidden">
  ${p.field('Trip name', p.input('Delhi weekend'))}
  ${p.field('Dates', `<div style="display:flex;gap:12px">${dateBox('Start', '4 Nov 2025')}${dateBox('End', '7 Nov 2025')}</div>
    <div style="margin-top:8px"><span style="${T.caption};color:${C.muted}">Clear dates</span></div>`)}
  ${p.field('Currency', `<div style="display:flex;flex-wrap:wrap;gap:8px">
    ${CURRENCIES.slice(0, 6).map((c) => p.chip(c, { on: c === 'INR' })).join('')}</div>`)}
  ${p.field('Total budget', p.input('15000', { prefix: '₹' }),
    'Optional. Leave empty to track spending without an overall cap.')}
  <div style="display:flex;flex-direction:column;gap:16px;margin-top:4px">
    ${p.button('Save changes', { ic: 'check' })}
    ${p.button('Delete trip', { variant: 'danger', ic: 'trash' })}
  </div>
</div>
`));

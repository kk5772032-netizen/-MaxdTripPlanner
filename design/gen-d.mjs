import { writeFileSync } from 'node:fs';
import { C, T, ELEV, dc, icon, iconFill, CAT_ICON } from './lib.mjs';
import * as p from './parts.mjs';
const w = (f, s) => { writeFileSync(f, s); console.log('  ', f); };

/* ---------------- P15 · Expenses log ---------------- */
const expRow = (cat, note, meta, amount) => `
<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:64px">
  ${p.catTile(cat)}
  <div style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0">
    <span style="${T.bodyS};color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${note}</span>
    <span style="${T.caption};color:${C.muted}">${meta}</span>
  </div>
  <span style="${T.amount};color:${C.text}">${amount}</span>
</div>`;

const filterRow = (label, chips) => `
<div style="display:flex;flex-direction:column;gap:8px">
  <span style="${T.label};color:${C.muted}">${label}</span>
  <div style="display:flex;gap:8px;overflow:hidden">${chips}</div>
</div>`;

w('Expenses.dc.html', dc(`
${p.header('Expenses', { right: p.headerAction('Add', 'plus') })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${filterRow('Stop', [
    p.chip('All', { on: true }), p.chip('Whole trip'), p.chip('India Gate'), p.chip("Humayun's"),
  ].join(''))}
  ${filterRow('Category', [
    p.chip('All', { on: true }),
    p.chip('Food', { ic: CAT_ICON.food, color: C.food }),
    p.chip('Activity', { ic: CAT_ICON.activity, color: C.activity }),
    p.chip('Transport', { ic: CAT_ICON.transport, color: C.transport }),
  ].join(''))}
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <span style="${T.label};color:${C.muted}">12 expenses</span>
    <span style="${T.title};color:${C.text};font-variant-numeric:tabular-nums">₹6,650.00</span>
  </div>
  ${p.listGroup([
    expRow('transport', 'Flights to Delhi', 'Whole trip · 2 Nov 2025', '₹8,000.00'),
    expRow('food', "Lunch at Karim's", 'India Gate · 4 Nov 2025', '₹450.00'),
    expRow('activity', 'Boat ride', 'India Gate · 4 Nov 2025', '₹1,200.00'),
    expRow('food', 'Dinner', "Humayun's Tomb · 5 Nov 2025", '₹1,900.00'),
    expRow('lodging', 'Guest house, 2 nights', 'Connaught Place · 5 Nov 2025', '₹3,400.00'),
    expRow('other', 'Museum donation', 'Connaught Place · 6 Nov 2025', '₹200.00'),
  ])}
  <span style="${T.caption};color:${C.faint};text-align:center">Tap to edit, long-press to delete.</span>
</div>
`));

/* ---------------- P15b · Expenses, filtered empty ---------------- */
w('ExpensesEmpty.dc.html', dc(`
${p.header('Expenses', { right: p.headerAction('Add', 'plus') })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${filterRow('Stop', [p.chip('All'), p.chip('Whole trip'), p.chip('India Gate', { on: true })].join(''))}
  ${filterRow('Category', [
    p.chip('All'),
    p.chip('Food', { ic: CAT_ICON.food, color: C.food }),
    p.chip('Transport', { ic: CAT_ICON.transport, color: C.transport, on: true }),
  ].join(''))}
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <span style="${T.label};color:${C.muted}">0 expenses</span>
    <span style="${T.title};color:${C.text};font-variant-numeric:tabular-nums">₹0.00</span>
  </div>
  ${p.emptyState('filter', 'Nothing matches those filters', 'Try widening the stop or category filter.')}
</div>
`));

/* ---------------- P16 · Add expense ---------------- */
const CATS = ['food', 'activity', 'transport', 'lodging', 'other'];
const LBL = { food: 'Food', activity: 'Activity', transport: 'Transport', lodging: 'Lodging', other: 'Other' };

w('ExpenseForm.dc.html', dc(`
${p.header('Expenses', { right: p.headerAction('Close', 'close') })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${p.card(`
    ${p.field('New expense', p.input('450', { prefix: '₹', focus: true, style: 'min-height:52px' }))}
    ${p.field('Category', `<div style="display:flex;flex-wrap:wrap;gap:8px">
      ${CATS.map((c) => p.chip(LBL[c], { ic: CAT_ICON[c], color: C[c], on: c === 'food' })).join('')}</div>`)}
    ${p.field('Stop', `<div style="display:flex;flex-wrap:wrap;gap:8px">
      ${p.chip('Whole trip', { ic: 'globe' })}${p.chip('India Gate', { ic: 'location', on: true })}
      ${p.chip("Humayun's Tomb", { ic: 'location' })}</div>`,
      "Leave on \\u201cWhole trip\\u201d for flights, visas and anything not tied to one place.")}
    ${p.field('Date', `<div style="display:flex;gap:12px;align-items:center">
      <div style="flex:1">${p.input('4 Nov 2025')}</div>
      <div style="min-height:36px;display:flex;align-items:center;padding:0 12px;border-radius:999px;
        background:${C.primarySoft}"><span style="${T.label};color:${C.primary}">Today</span></div></div>`)}
    ${p.field('Note', p.input("Lunch at Karim's"), 'Optional.')}
    <div style="display:flex;gap:12px">
      <div style="flex:1">${p.button('Add expense', { ic: 'check' })}</div>
      <div style="flex:1">${p.button('Cancel', { variant: 'secondary' })}</div>
    </div>`, { gap: 4 })}
</div>
`));

/* ---------------- P17 · Dashboard ---------------- */
const stat = (label, value) => `<div style="flex:1;background:${C.surface};border:1px solid ${C.border};
  border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:2px;${ELEV.sm}">
  <span style="${T.captionS};color:${C.muted}">${label}</span>
  <span style="${T.heading};color:${C.text};font-variant-numeric:tabular-nums">${value}</span></div>`;

const pvaGroup = (name, actual, plannedW, actualW, status, caption) => `
<div style="display:flex;flex-direction:column;gap:2px">
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <span style="${T.label};color:${C.text}">${name}</span>
    <span style="${T.label};color:${status === 'over' ? C.over : C.text};font-variant-numeric:tabular-nums">${actual}</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:2px;margin:2px 0">
    <div style="height:8px;border-radius:4px;background:${C.sunken};overflow:hidden">
      <div style="height:100%;width:${plannedW}%;background:${C.borderStrong};border-radius:4px"></div></div>
    <div style="height:8px;border-radius:4px;background:${C.sunken};overflow:hidden">
      <div style="height:100%;width:${actualW}%;background:${C[status]};border-radius:4px"></div></div>
  </div>
  <span style="font-size:11px;line-height:15px;color:${C.faint}">${caption}</span>
</div>`;

/** Donut slice path, angles clockwise from 12 o'clock. */
function slice(cx, cy, ro, ri, a0, a1) {
  const rad = (d) => ((d - 90) * Math.PI) / 180;
  const pt = (r, a) => `${(cx + r * Math.cos(rad(a))).toFixed(2)} ${(cy + r * Math.sin(rad(a))).toFixed(2)}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${pt(ro, a0)} A ${ro} ${ro} 0 ${large} 1 ${pt(ro, a1)} L ${pt(ri, a1)} A ${ri} ${ri} 0 ${large} 0 ${pt(ri, a0)} Z`;
}

function donut(data, size = 180) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const ro = size / 2, ri = ro * 0.58, gap = 1.5;
  let a = 0, out = '';
  for (const d of data) {
    const sweep = (d.v / total) * 360;
    out += `<path d="${slice(ro, ro, ro, ri, a + gap / 2, a + sweep - gap / 2)}" fill="${C[d.cat]}"/>`;
    a += sweep;
  }
  return `<svg width="${size}" height="${size}" style="flex:none">${out}</svg>`;
}

const legend = (cat, label, amount, share) => `
<div style="display:flex;align-items:center;gap:8px">
  <div style="width:10px;height:10px;border-radius:3px;background:${C[cat]};flex:none"></div>
  <span style="flex:1;${T.label};font-weight:400;color:${C.text}">${label}</span>
  <span style="${T.label};color:${C.text};font-variant-numeric:tabular-nums">${amount}</span>
  <span style="${T.caption};color:${C.faint};width:38px;text-align:right;font-variant-numeric:tabular-nums">${share}</span>
</div>`;

const PIE = [
  { cat: 'food', v: 2400 }, { cat: 'transport', v: 1900 },
  { cat: 'activity', v: 1350 }, { cat: 'lodging', v: 1000 },
];

w('Dashboard.dc.html', dc(`
${p.header('Dashboard')}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${p.card(`
    <span style="${T.label};color:${C.muted}">Remaining budget</span>
    <span style="${T.hero};color:${C.text};font-variant-numeric:tabular-nums">₹8,350</span>
    <div style="margin-top:8px">${p.budgetBar('₹6,650', '₹15,000', 'near', { planned: 9200 })}</div>
    ${p.notice('This trip is close to its total budget.', { tone: 'warning' })}`, { gap: 8 })}
  <div style="display:flex;gap:12px">
    ${stat('Budget', '₹15,000')}${stat('Planned', '₹9,200')}${stat('Actual', '₹6,650')}
  </div>
  ${p.card(`
    <span style="${T.heading};color:${C.text}">Planned vs actual per stop</span>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:10px;height:10px;border-radius:3px;background:${C.borderStrong}"></div>
        <span style="${T.caption};color:${C.muted}">Planned</span></div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:10px;height:10px;border-radius:3px;background:${C.primary}"></div>
        <span style="${T.caption};color:${C.muted}">Actual <span style="color:${C.faint}">(coloured by budget status)</span></span></div>
    </div>
    ${pvaGroup('India Gate', '₹450', 33, 11, 'under', 'Planned ₹1,400 · cap ₹3,000')}
    ${pvaGroup("Humayun's Tomb", '₹1,900', 37, 44, 'near', 'Planned ₹1,600 · cap ₹2,200')}
    ${pvaGroup('Connaught Place', '₹4,300', 72, 100, 'over', 'Planned ₹3,100 · cap ₹3,500')}`, { gap: 16 })}
  ${p.card(`
    <span style="${T.heading};color:${C.text}">Where the money went</span>
    <div style="display:flex;justify-content:center">${donut(PIE)}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${legend('food', 'Food', '₹2,400', '36%')}
      ${legend('transport', 'Transport', '₹1,900', '29%')}
      ${legend('activity', 'Activity', '₹1,350', '20%')}
      ${legend('lodging', 'Lodging', '₹1,000', '15%')}
    </div>
    <span style="${T.caption};color:${C.faint}">₹8,000 of this isn't tied to a stop — flights, visas and the like.</span>`,
    { gap: 16 })}
</div>
`, { h: 1180 }));

import { writeFileSync } from 'node:fs';
import { C, T, ELEV, dc, icon, iconFill } from './lib.mjs';
import * as p from './parts.mjs';
const w = (f, s) => { writeFileSync(f, s); console.log('  ', f); };

const notesBlock = (val, saved) => `
<div style="display:flex;flex-direction:column;gap:4px">
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <span style="${T.label};color:${C.muted}">Notes</span>
    ${saved ? `<span style="${T.captionS};color:${C.under}">Saved</span>` : ''}
  </div>
  ${p.input(val, { multiline: true, style: 'min-height:60px' })}
</div>`;

const tabs = (active) => p.segmented([
  { label: 'To do 3', ic: 'checkbox', on: active === 'todo' },
  { label: 'Food 2', ic: 'food', on: active === 'food' },
  { label: 'Budget', ic: 'wallet', on: active === 'budget' },
]);

const stopHead = (active) => `${p.header('India Gate')}
<div style="flex:none;padding:16px 16px 12px;display:flex;flex-direction:column;gap:12px">
  ${notesBlock('Sunset is best, enter from the south gate', true)}
  ${tabs(active)}
</div>`;

/* ---------------- P12 · Stop detail, To do ---------------- */
const todoRow = (title, cost, done) => `
<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:56px">
  <div style="width:24px;height:24px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;
    ${done ? `background:${C.under};border:1.5px solid ${C.under}` : `border:1.5px solid ${C.borderStrong}`}">
    ${done ? icon('check', 14, '#fff', 2.4) : ''}</div>
  <span style="flex:1;${T.body};color:${done ? C.faint : C.text};${done ? 'text-decoration:line-through' : ''}">${title}</span>
  ${cost ? `<span style="${T.label};color:${C.muted};font-variant-numeric:tabular-nums">${cost}</span>` : ''}
  <div style="width:30px;height:30px;border-radius:15px;background:${C.sunken};display:flex;align-items:center;
    justify-content:center;flex:none">${icon('trash', 15, C.over)}</div>
</div>`;

w('StopToDo.dc.html', dc(`
${stopHead('todo')}
<div style="flex:1;padding:0 16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${p.card(`${p.input('', { placeholder: 'Walk to the war memorial' })}
    <div style="display:flex;gap:12px;align-items:center">
      <div style="flex:1">${p.input('', { placeholder: 'Est. cost (optional)', prefix: '₹' })}</div>
      ${p.button('Add', { style: 'min-height:48px;padding:0 20px' })}
    </div>`)}
  <div style="display:flex;justify-content:space-between">
    <span style="${T.label};color:${C.muted}">1 of 3 done</span>
    <span style="${T.label};color:${C.muted};font-variant-numeric:tabular-nums">Planned ₹1,400</span>
  </div>
  ${p.listGroup([
    todoRow('Walk the memorial', '₹200', true),
    todoRow('Sunset photos at the arch', null, false),
    todoRow('Boat ride at the canal', '₹1,200', false),
  ])}
  <span style="${T.caption};color:${C.faint};text-align:center">Tap a row to tick it off.</span>
</div>
`));

/* ---------------- P13 · Stop detail, Food ---------------- */
const planRow = (name, meta, cost) => `
<div style="display:flex;align-items:center;gap:12px;padding:12px">
  <div style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0">
    <span style="${T.bodyS};color:${C.text}">${name}</span>
    <span style="${T.caption};color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta}</span>
  </div>
  <div style="width:104px;flex:none">${p.input(cost, { prefix: '₹', style: 'min-height:40px' })}</div>
  <div style="width:30px;height:30px;border-radius:15px;background:${C.sunken};display:flex;align-items:center;
    justify-content:center;flex:none">${icon('trash', 15, C.over)}</div>
</div>`;

const nearbyRow = (name, cuisine, rating, price, added) => `
<div style="display:flex;align-items:center;gap:12px;padding:12px">
  <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
    <span style="${T.bodyS};color:${C.text}">${name}</span>
    <div style="display:flex;align-items:center;gap:4px">
      <span style="${T.caption};color:${C.muted}">${cuisine}</span>
      <span style="${T.caption};color:${C.faint}">·</span>
      ${iconFill('star', 11, C.near)}
      <span style="${T.caption};color:${C.muted}">${rating}</span>
      <span style="${T.caption};color:${C.faint}">·</span>
      <span style="${T.caption};color:${C.muted}">${price}</span>
    </div>
  </div>
  <div style="min-height:34px;display:flex;align-items:center;padding:0 12px;border-radius:999px;
    background:${added ? C.sunken : C.primarySoft};flex:none">
    <span style="${T.label};color:${added ? C.faint : C.primary}">${added ? 'Added' : 'Add'}</span></div>
</div>`;

w('StopFood.dc.html', dc(`
${stopHead('food')}
<div style="flex:1;padding:0 16px;display:flex;flex-direction:column;gap:24px;overflow:hidden">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="${T.heading};color:${C.text}">Your food plan</span>
      <span style="${T.label};color:${C.muted};font-variant-numeric:tabular-nums">Planned ₹1,600</span>
    </div>
    ${p.listGroup([planRow("Karim's", 'Mughlai · go early', '600'), planRow('Indian Accent', 'Modern Indian', '1000')])}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="${T.heading};color:${C.text}">Restaurants nearby</span>
      <div style="display:flex;align-items:center;gap:5px">${icon('refresh', 15, C.primary)}
        <span style="${T.label};color:${C.primary}">Refresh</span></div>
    </div>
    ${p.listGroup([
      nearbyRow("Karim's", 'North Indian', '4.4', '₹₹', true),
      nearbyRow('Saravana Bhavan', 'South Indian', '4.2', '₹', false),
      nearbyRow('The Spice Route', 'Pan-Asian', '4.6', '₹₹₹₹', false),
      nearbyRow('Andhra Bhavan Canteen', 'Andhra', '4.3', '₹', false),
    ])}
  </div>
  <span style="${T.label};color:${C.primary}">Add a place manually instead</span>
</div>
`, { h: 960 }));

/* ---------------- P14 · Stop detail, Budget ---------------- */
const figure = (label, value, over) => `<div style="display:flex;justify-content:space-between;align-items:center">
  <span style="${T.body};color:${C.muted}">${label}</span>
  <span style="${T.amount};color:${over ? C.over : C.text}">${value}</span></div>`;

w('StopBudget.dc.html', dc(`
${stopHead('budget')}
<div style="flex:1;padding:0 16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${p.card(`${p.field('Budget for this stop', p.input('3,000', { prefix: '₹' }),
    "The cap you don't want to exceed here. Leave empty for no cap.")}
    ${p.button('Save budget', { ic: 'check' })}`)}
  ${p.card(`
    ${p.budgetBar('₹450', '₹3,000', 'under', { label: 'Spent against budget', planned: 1400 })}
    <div style="display:flex;flex-direction:column;gap:8px">
      ${figure('Planned', '₹1,400')}${figure('Actual', '₹450')}${figure('Remaining', '₹2,550')}
    </div>
    <span style="${T.caption};color:${C.faint}">Planned is what your activities and food plan add up to.
      The tick on the bar marks it against your cap.</span>`)}
  ${p.button('View 3 expenses', { variant: 'secondary', ic: 'receipt' })}
  ${p.button('Remove stop', { variant: 'danger', ic: 'trash' })}
</div>
`));

/* ---------------- P14b · Stop budget, over ---------------- */
w('StopBudgetOver.dc.html', dc(`
${p.header('Connaught Place')}
<div style="flex:none;padding:16px 16px 12px;display:flex;flex-direction:column;gap:12px">
  ${notesBlock('Janpath market first, then dinner', false)}
  ${p.segmented([{ label: 'To do 3', ic: 'checkbox' }, { label: 'Food 4', ic: 'food' }, { label: 'Budget', ic: 'wallet', on: true }])}
</div>
<div style="flex:1;padding:0 16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${p.card(`${p.field('Budget for this stop', p.input('3,500', { prefix: '₹' }),
    "The cap you don't want to exceed here. Leave empty for no cap.")}
    ${p.button('Save budget', { ic: 'check' })}`)}
  ${p.card(`
    ${p.budgetBar('₹4,300', '₹3,500', 'over', { label: 'Spent against budget', note: '₹800 over budget' })}
    <div style="display:flex;flex-direction:column;gap:8px">
      ${figure('Planned', '₹3,100')}${figure('Actual', '₹4,300')}${figure('Remaining', '-₹800', true)}
    </div>`)}
  ${p.button('View 7 expenses', { variant: 'secondary', ic: 'receipt' })}
  ${p.button('Remove stop', { variant: 'danger', ic: 'trash' })}
</div>
`));

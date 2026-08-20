import { writeFileSync } from 'node:fs';
import { C, T, ELEV, dc, icon, iconFill } from './lib.mjs';
import * as p from './parts.mjs';
const w = (f, s) => { writeFileSync(f, s); console.log('  ', f); };

const tripFooter = () => p.stickyFooter(`
  ${p.budgetBar('₹6,650', '₹15,000', 'near', { label: 'Trip total', planned: 9200, cap: 15000 })}
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;align-items:center;gap:5px">${icon('receipt', 15, C.primary)}
      <span style="${T.label};color:${C.primary}">12 expenses</span></div>
    <div style="display:flex;align-items:center;gap:5px">
      <span style="${T.label};color:${C.primary};font-variant-numeric:tabular-nums">₹8,350 left</span>
      ${icon('chart', 15, C.primary)}</div>
  </div>`);

/* ---------------- P07 · Trip detail, itinerary ---------------- */
w('TripItinerary.dc.html', dc(`
${p.header('Delhi weekend', { right: p.headerAction('Edit', 'edit') })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
  <div style="display:flex;align-items:center;gap:4px">${icon('calendar', 14, C.faint)}
    <span style="${T.caption};color:${C.muted}">4–7 Nov 2025</span></div>
  ${p.segmented([{ label: 'Itinerary', ic: 'list', on: true }, { label: 'Map', ic: 'map' }])}
  ${p.notice('Connaught Place is over its budget.', { tone: 'warning' })}
  <span style="${T.caption};color:${C.faint}">Drag a handle to reorder stops.</span>
  ${p.stopCard(1, 'India Gate', 'Kartavya Path, New Delhi', '2 activities · 3 food spots',
    p.budgetBar('₹450', '₹3,000', 'under', { compact: true, planned: 1400, cap: 3000 }), { rating: '4.6' })}
  ${p.stopCard(2, "Humayun's Tomb", 'Mathura Road, Nizamuddin', '1 activity · 2 food spots',
    p.budgetBar('₹1,900', '₹2,200', 'near', { compact: true, planned: 1600, cap: 2200 }), { rating: '4.5' })}
  ${p.stopCard(3, 'Connaught Place', 'Rajiv Chowk, New Delhi', '3 activities · 4 food spots',
    p.budgetBar('₹4,300', '₹3,500', 'over', { compact: true, note: '₹800 over budget' }), { rating: '4.3' })}
</div>
${p.fab({ bottom: 116 + p.INSET })}
${tripFooter()}
`));

/* ---------------- P08 · Trip detail, map ---------------- */
const pin = (n, x, y, sel) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%)">
  ${sel ? `<div style="position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:${C.surface};
    border-radius:12px;padding:10px 12px;${ELEV.md};width:186px;display:flex;align-items:center;gap:8px">
    <div style="flex:1;display:flex;flex-direction:column;gap:1px">
      <span style="${T.bodyS};color:${C.text};white-space:nowrap">Humayun's Tomb</span>
      <span style="${T.caption};color:${C.muted};white-space:nowrap">Mathura Road, Nizamuddin</span></div>
    ${icon('chevron', 16, C.faint)}</div>` : ''}
  <div style="width:28px;height:28px;border-radius:14px;background:${C.primary};border:2px solid #fff;
    display:flex;align-items:center;justify-content:center;${ELEV.md}">
    <span style="${T.captionS};color:#fff">${n}</span></div></div>`;

w('TripMap.dc.html', dc(`
${p.header('Delhi weekend', { right: p.headerAction('Edit', 'edit') })}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden;padding-bottom:150px">
  <div style="display:flex;align-items:center;gap:4px">${icon('calendar', 14, C.faint)}
    <span style="${T.caption};color:${C.muted}">4–7 Nov 2025</span></div>
  ${p.segmented([{ label: 'Itinerary', ic: 'list' }, { label: 'Map', ic: 'map', on: true }])}
  <span style="${T.caption};color:${C.faint}">Tap a pin, then its label, to open that stop.</span>
  <div style="flex:1;border-radius:16px;overflow:hidden;position:relative;background:#E8EDF2;border:1px solid ${C.border}">
    <svg width="100%" height="100%" style="position:absolute;inset:0">
      <rect width="100%" height="100%" fill="#E9EEF3"/>
      <path d="M-10 60 H400 M-10 150 H400 M-10 250 H400 M-10 330 H400" stroke="#DCE3EB" stroke-width="8"/>
      <path d="M60 -10 V420 M170 -10 V420 M280 -10 V420" stroke="#DCE3EB" stroke-width="8"/>
      <rect x="76" y="70" width="80" height="66" fill="#DFE7EE"/>
      <rect x="190" y="166" width="76" height="70" fill="#DFE7EE"/>
      <rect x="80" y="264" width="72" height="56" fill="#D9E8DC"/>
      <path d="M92 296 L200 196 L286 104" stroke="${C.primary}" stroke-width="3" stroke-dasharray="8 6" fill="none" stroke-linecap="round"/>
    </svg>
    ${pin(1, 92, 296)}${pin(2, 200, 196, true)}${pin(3, 286, 104)}
    <div style="position:absolute;left:12px;right:12px;bottom:12px;background:${C.surface};border-radius:12px;
      padding:8px 12px;${ELEV.sm}"><span style="${T.caption};color:${C.muted}">1 stop has no location and isn't shown.</span></div>
  </div>
</div>
${tripFooter()}
`));

/* ---------------- P09 · Add stop, search ---------------- */
const result = (a, b, on) => `<div style="padding:12px;min-height:56px;display:flex;flex-direction:column;
  justify-content:center;gap:1px;${on ? `background:${C.primarySoft};` : ''}">
  <span style="${T.bodyS};color:${C.text}">${a}</span>
  <span style="${T.caption};color:${C.muted}">${b}</span></div>`;

w('AddStopSearch.dc.html', dc(`
${p.header('Add stop')}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
  <div style="position:relative;display:flex;align-items:center">
    <div style="position:absolute;left:12px;display:flex">${icon('search', 17, C.faint)}</div>
    <div style="flex:1;background:${C.surface};border:1px solid ${C.primary};border-radius:12px;
      min-height:48px;display:flex;align-items:center;padding:0 40px">
      <span style="${T.body};color:${C.text}">india ga</span>
      <span style="width:1.5px;height:20px;background:${C.primary};margin-left:2px"></span></div>
    <div style="position:absolute;right:12px;width:16px;height:16px;border-radius:8px;
      border:2px solid ${C.border};border-top-color:${C.faint}"></div>
  </div>
  <div style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;overflow:hidden">
    ${result('India Gate', 'Kartavya Path, New Delhi, Delhi', true)}
    <div style="border-top:1px solid ${C.border}">${result('India Gate Circle', 'Rajpath Area, New Delhi')}</div>
    <div style="border-top:1px solid ${C.border}">${result('India Gate Lawns', 'New Delhi, Delhi')}</div>
    <div style="border-top:1px solid ${C.border}">${result('Indiana Gate Restaurant', 'Connaught Place, New Delhi')}</div>
    <div style="border-top:1px solid ${C.border}">${result('India Gate Metro', 'Central Secretariat, New Delhi')}</div>
  </div>
  <span style="${T.label};color:${C.primary}">Add manually instead</span>
</div>
`));

/* ---------------- P10 · Add stop, confirm ---------------- */
w('AddStopConfirm.dc.html', dc(`
${p.header('Add stop')}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  <div style="position:relative;display:flex;align-items:center">
    <div style="position:absolute;left:12px;display:flex">${icon('search', 17, C.faint)}</div>
    <div style="flex:1;background:${C.surface};border:1px solid ${C.border};border-radius:12px;
      min-height:48px;display:flex;align-items:center;padding:0 40px">
      <span style="${T.body};color:${C.faint}">Search for a place</span></div>
  </div>
  ${p.card(`
    <div style="height:140px;border-radius:12px;overflow:hidden;background:#DCE3EA;position:relative">
      <svg width="100%" height="140" viewBox="0 0 326 140" preserveAspectRatio="xMidYMid slice">
        <rect width="326" height="140" fill="#C7D2DC"/>
        <rect y="96" width="326" height="44" fill="#B4C2CE"/>
        <path d="M112 96V52a51 51 0 0 1 102 0v44" fill="#DDE5EC"/>
        <rect x="140" y="60" width="46" height="36" rx="23" fill="#C7D2DC"/>
        <rect x="104" y="90" width="118" height="8" fill="#E6ECF1"/>
        <circle cx="252" cy="34" r="14" fill="#DFE7ED"/>
      </svg>
    </div>
    <span style="${T.heading};color:${C.text}">India Gate</span>
    <span style="${T.caption};color:${C.muted}">Kartavya Path, India Gate, New Delhi, Delhi 110001</span>
    <div style="display:flex;align-items:center;gap:4px">${iconFill('star', 13, C.near)}
      <span style="${T.captionS};color:${C.muted}">4.6</span></div>
    <div style="display:flex;gap:12px;margin-top:4px">
      <div style="flex:1">${p.button('Add this stop', { ic: 'plus' })}</div>
      <div style="flex:1">${p.button('Cancel', { variant: 'secondary' })}</div>
    </div>`, { gap: 6 })}
</div>
`));

/* ---------------- P11 · Add stop, no key / manual ---------------- */
w('AddStopManual.dc.html', dc(`
${p.header('Add stop')}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
  ${p.notice('Set a Google Places key to search real places. You can still add stops by typing them below.',
    { tone: 'info', ic: 'search', title: 'Place search is off' })}
  <span style="${T.label};color:${C.primary}">Hide manual entry</span>
  <div style="display:flex;flex-direction:column;gap:20px">
    ${p.field('Place name', p.input('India Gate', { focus: true }))}
    ${p.field('Address', p.input('', { placeholder: 'Kartavya Path, New Delhi' }), 'Optional.')}
    ${p.field('Notes', p.input('', { placeholder: 'Best at sunset', multiline: true }),
      'Optional. Anything worth remembering about this stop.')}
    ${p.button('Add stop', { ic: 'plus' })}
  </div>
</div>
`));

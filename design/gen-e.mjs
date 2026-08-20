import { writeFileSync } from 'node:fs';
import { C, T, ELEV, dc, icon, iconFill, CAT_ICON } from './lib.mjs';
import * as p from './parts.mjs';
const w = (f, s) => { writeFileSync(f, s); console.log('  ', f); };

/* ---------------- P01 · Onboarding ---------------- */
const art = (svg) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px">${svg}</div>`;

const routeArt = `<svg width="240" height="200" viewBox="0 0 240 200" fill="none">
  <rect x="8" y="18" width="224" height="164" rx="14" fill="${C.sunken}"/>
  <path d="M8 92h224M8 138h224M74 18v164M158 18v164" stroke="#E7EBF0" stroke-width="7"/>
  <path d="M52 150 L118 106 L186 62" stroke="${C.primary}" stroke-width="3.5" stroke-dasharray="9 7" stroke-linecap="round"/>
  <circle cx="52" cy="150" r="13" fill="${C.accent}"/><text x="52" y="155" font-size="13" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui">1</text>
  <circle cx="118" cy="106" r="13" fill="${C.accent}"/><text x="118" y="111" font-size="13" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui">2</text>
  <circle cx="186" cy="62" r="13" fill="${C.accent}"/><text x="186" y="67" font-size="13" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui">3</text>
</svg>`;

const budgetArt = `<svg width="240" height="200" viewBox="0 0 240 200" fill="none">
  <rect x="14" y="34" width="212" height="90" rx="14" fill="#fff" stroke="${C.border}"/>
  <circle cx="42" cy="60" r="12" fill="${C.primarySoft}"/>
  <text x="42" y="65" font-size="12" font-weight="700" fill="${C.primary}" text-anchor="middle" font-family="system-ui">1</text>
  <rect x="62" y="53" width="88" height="9" rx="4.5" fill="${C.borderStrong}"/>
  <rect x="62" y="70" width="56" height="7" rx="3.5" fill="${C.border}"/>
  <rect x="30" y="96" width="180" height="10" rx="5" fill="${C.sunken}"/>
  <rect x="30" y="96" width="58" height="10" rx="5" fill="${C.under}"/>
  <rect x="14" y="136" width="102" height="46" rx="12" fill="#fff" stroke="${C.border}"/>
  <rect x="30" y="152" width="16" height="16" rx="4" fill="${C.under}"/>
  <rect x="54" y="157" width="46" height="7" rx="3.5" fill="${C.border}"/>
  <rect x="124" y="136" width="102" height="46" rx="12" fill="#fff" stroke="${C.border}"/>
  <rect x="140" y="150" width="20" height="20" rx="5" fill="${C.food}" opacity=".18"/>
  <rect x="168" y="157" width="44" height="7" rx="3.5" fill="${C.border}"/>
</svg>`;

const trackArt = `<svg width="240" height="200" viewBox="0 0 240 200" fill="none">
  <circle cx="120" cy="86" r="56" fill="none" stroke="${C.food}" stroke-width="26" stroke-dasharray="126 226"/>
  <circle cx="120" cy="86" r="56" fill="none" stroke="${C.transport}" stroke-width="26" stroke-dasharray="100 252" stroke-dashoffset="-130"/>
  <circle cx="120" cy="86" r="56" fill="none" stroke="${C.activity}" stroke-width="26" stroke-dasharray="70 282" stroke-dashoffset="-234"/>
  <circle cx="120" cy="86" r="56" fill="none" stroke="${C.lodging}" stroke-width="26" stroke-dasharray="52 300" stroke-dashoffset="-308"/>
  <rect x="60" y="164" width="120" height="30" rx="15" fill="${C.nearSoft}"/>
  <text x="120" y="184" font-size="13" font-weight="600" fill="${C.nearText}" text-anchor="middle" font-family="system-ui">Close to cap</text>
</svg>`;

const panel = (svg, title, body, dot, last) => dc(`
<div style="flex:none;display:flex;justify-content:flex-end;padding:16px">
  <span style="${T.body};color:${C.muted}">${last ? '' : 'Skip'}</span></div>
${art(svg)}
<div style="flex:none;padding:0 24px 32px;display:flex;flex-direction:column;gap:12px;align-items:center">
  <span style="${T.title};color:${C.text};text-align:center;text-wrap:balance">${title}</span>
  <span style="${T.body};color:${C.muted};text-align:center;text-wrap:pretty">${body}</span>
  <div style="display:flex;gap:6px;margin:12px 0 4px">
    ${[0, 1, 2].map((i) => `<div style="width:${i === dot ? 20 : 7}px;height:7px;border-radius:4px;
      background:${i === dot ? C.primary : C.borderStrong}"></div>`).join('')}
  </div>
  <div style="align-self:stretch">${p.button(last ? 'Get started' : 'Next')}</div>
</div>`, { bg: C.surface });

w('Onboarding1.dc.html', panel(routeArt, 'Plan the route, not just the trip',
  "Add the places you want to see, in the order you'll see them.", 0, false));
w('Onboarding2.dc.html', panel(budgetArt, 'Decide what it should cost',
  'Give each stop a budget, then plan the things to do and places to eat inside it.', 1, false));
w('Onboarding3.dc.html', panel(trackArt, 'Watch it as it happens',
  'Log what you actually spend. Waypoint tells you the moment a stop starts running over.', 2, true));

/* ---------------- P02 · Notification priming ---------------- */
const primeRow = (ic, label, sub) => `
<div style="display:flex;gap:12px;align-items:flex-start">
  <div style="margin-top:1px">${icon(ic, 20, C.muted)}</div>
  <div style="flex:1;display:flex;flex-direction:column;gap:1px">
    <span style="${T.bodyS};color:${C.text}">${label}</span>
    <span style="${T.caption};color:${C.muted}">${sub}</span></div>
</div>`;

w('NotifyPriming.dc.html', dc(`
<div style="flex:1;background:${C.overlay || 'rgba(12,17,29,.45)'}"></div>
<div style="flex:none;background:${C.surface};border-radius:20px 20px 0 0;padding:28px 24px ${24 + p.INSET}px;
  display:flex;flex-direction:column;gap:16px;${ELEV.lg}">
  <div style="width:56px;height:56px;border-radius:28px;background:${C.primarySoft};display:flex;
    align-items:center;justify-content:center">${icon('bell', 26, C.primary)}</div>
  <span style="${T.title};color:${C.text};text-wrap:balance">Know before you overspend</span>
  <span style="${T.body};color:${C.muted};text-wrap:pretty">Waypoint can tell you when a stop passes 80% of its
    budget, and remind you to log what you spent at the end of each day. Nothing else.</span>
  <div style="display:flex;flex-direction:column;gap:14px;margin:4px 0">
    ${primeRow('alert', 'Budget alerts', 'When a stop or the trip nears its cap')}
    ${primeRow('clock', 'Daily reminder', "One nudge each evening while you're away")}
    ${primeRow('lock', 'Nothing leaves your phone', 'No account, no tracking')}
  </div>
  ${p.button('Turn on alerts')}
  ${p.button('Not now', { variant: 'ghost' })}
</div>`, { bg: 'rgba(12,17,29,.45)' }));

/* ---------------- P18 · Settings ---------------- */
const setRow = (ic, label, { value, chev = true, sub, sw, danger, action } = {}) => `
<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:56px">
  ${icon(ic, 20, danger ? C.over : C.muted)}
  <div style="flex:1;display:flex;flex-direction:column;gap:1px">
    <span style="${T.body};color:${danger ? C.overText : C.text}">${label}</span>
    ${sub ? `<span style="${T.caption};color:${C.muted}">${sub}</span>` : ''}
  </div>
  ${value ? `<span style="${T.body};color:${C.muted}">${value}</span>` : ''}
  ${action ? `<span style="${T.label};color:${C.primary}">${action}</span>` : ''}
  ${sw !== undefined ? `<div style="width:46px;height:28px;border-radius:14px;flex:none;
    background:${sw ? C.primary : C.borderStrong};position:relative">
    <div style="position:absolute;top:2px;${sw ? 'right:2px' : 'left:2px'};width:24px;height:24px;
      border-radius:12px;background:#fff;${ELEV.sm}"></div></div>` : ''}
  ${chev && !sw && !action ? icon('chevron', 18, C.faint) : ''}
</div>`;

const section = (title, rows) => `
<div style="display:flex;flex-direction:column;gap:8px">
  <span style="${T.label};color:${C.muted};padding-left:4px">${title}</span>
  ${p.listGroup(rows)}
</div>`;

w('Settings.dc.html', dc(`
${p.header('Settings')}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:20px;overflow:hidden">
  ${section('Defaults', [
    setRow('wallet', 'Currency', { value: 'INR ₹', sub: 'Pre-selected on a new trip' }),
  ])}
  ${section('Appearance', [
    `<div style="padding:12px 16px">${p.segmented([
      { label: 'System', ic: 'phone' }, { label: 'Light', ic: 'sun' }, { label: 'Dark', ic: 'moon', on: true },
    ])}</div>`,
  ])}
  ${section('Notifications', [
    setRow('bell', 'Budget alerts', { sw: true, chev: false, sub: 'When a stop or the trip nears its cap' }),
    setRow('clock', 'Daily expense reminder', { sw: true, chev: false, sub: 'Every day at 20:00 while a trip is running' }),
    setRow('dots', 'All notification settings', {}),
  ])}
  ${section('Place search', [
    `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:56px">
      <div style="width:8px;height:8px;border-radius:4px;background:${C.under};margin:0 6px"></div>
      <span style="flex:1;${T.body};color:${C.text}">Places API connected</span>${icon('chevron', 18, C.faint)}</div>`,
    setRow('dots', 'Cached place data', { value: '1.2 MB', chev: false, action: 'Clear',
      sub: 'Reused for 30 days to keep the Places bill down' }),
  ])}
  ${section('Your data', [
    setRow('trash', 'Delete all data', { danger: true }),
  ])}
  <span style="${T.caption};color:${C.faint};text-align:center;padding:8px 24px;text-wrap:pretty">Waypoint 1.0.0 ·
    Everything is stored on this device. No account, no sync.</span>
</div>
`, { h: 1030 }));

/* ---------------- P19 · Notification settings ---------------- */
w('NotifySettings.dc.html', dc(`
${p.header('Notifications')}
<div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:20px;overflow:hidden">
  ${p.notice('Waypoint only notifies you about your own budgets. Nothing is sent anywhere.',
    { tone: 'info', ic: 'lock' })}
  ${section('Budget alerts', [
    setRow('bell', 'Budget alerts', { sw: true, chev: false }),
    `<div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px">
      <span style="${T.label};color:${C.muted}">Alert me at</span>
      ${p.segmented([{ label: '80%' }, { label: '100%' }, { label: 'Both', on: true }])}</div>`,
    setRow('location', 'Per-stop alerts', { sw: true, chev: false, sub: 'When one stop passes its own cap' }),
    setRow('map', 'Trip total alerts', { sw: true, chev: false, sub: 'When the whole trip passes its budget' }),
  ])}
  ${section('Reminders', [
    setRow('clock', 'Daily expense reminder', { sw: true, chev: false, sub: 'A nudge to log what you spent' }),
    setRow('clock', 'Time', { value: '8:00 PM' }),
    setRow('calendar', 'Trip starting soon', { sw: true, chev: false, sub: 'The evening before your start date' }),
  ])}
  ${section('Quiet', [
    setRow('lock', 'Only while a trip is running', { sw: true, chev: false, sub: 'No notifications between trips' }),
  ])}
</div>
`, { h: 1000 }));

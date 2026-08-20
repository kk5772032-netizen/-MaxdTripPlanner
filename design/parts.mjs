import { C, T, ELEV, icon, iconFill, CAT_ICON } from './lib.mjs';

const BOTTOM_INSET = 34;   // gesture bar
const G = 16;              // screen gutter

/** Native-stack style header. No fake status bar — the OS draws the real one. */
export function header(title, { back = true, right = '', big = false, t = C } = {}) {
  return `<div style="flex:none;background:${t.surface};border-bottom:1px solid ${t.border};
    padding:14px ${G}px;display:flex;align-items:center;gap:12px;min-height:56px">
    ${back ? `<span style="display:flex;color:${t.primary}">${icon('back', 22, t.primary, 2)}</span>` : ''}
    <div style="flex:1;${big ? T.title : T.heading};color:${t.text}">${title}</div>
    ${right}
  </div>`;
}

export function headerAction(label, ic, { t = C, tone } = {}) {
  const col = tone === 'danger' ? t.over : t.primary;
  return `<div style="display:flex;align-items:center;gap:5px;color:${col}">
    ${ic ? icon(ic, 18, col) : ''}<span style="${T.bodyS}">${label}</span></div>`;
}

export function scroll(inner, { pad = G, gap = 16, t = C } = {}) {
  return `<div style="flex:1;overflow:hidden;padding:${pad}px;display:flex;flex-direction:column;gap:${gap}px">${inner}</div>`;
}

export function card(inner, { pad = 16, gap = 12, t = C, style = '' } = {}) {
  return `<div style="background:${t.surface};border:1px solid ${t.border};border-radius:16px;
    padding:${pad}px;display:flex;flex-direction:column;gap:${gap}px;${ELEV.sm};${style}">${inner}</div>`;
}

export function button(label, { variant = 'primary', ic, t = C, style = '' } = {}) {
  const map = {
    primary:   `background:${t.primary};color:${t.onPrimary};border:1px solid ${t.primary}`,
    secondary: `background:${t.surface};color:${t.primary};border:1px solid ${t.borderStrong}`,
    danger:    `background:${t.over};color:#fff;border:1px solid ${t.over}`,
    ghost:     `background:transparent;color:${t.primary};border:1px solid transparent`,
  };
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : t.primary;
  return `<div style="min-height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;
    gap:8px;padding:0 16px;${map[variant]};${style}">
    ${ic ? icon(ic, 17, fg) : ''}<span style="${T.bodyS};color:${fg}">${label}</span></div>`;
}

export function chip(label, { on = false, ic, color, t = C } = {}) {
  const tint = color ?? t.primary;
  return `<div style="display:flex;align-items:center;gap:5px;min-height:36px;padding:0 12px;border-radius:999px;
    background:${on ? tint + '14' : t.surface};border:1px solid ${on ? tint : t.border}">
    ${ic ? icon(ic, 14, on ? tint : t.muted) : ''}
    <span style="${T.label};color:${on ? tint : t.muted};white-space:nowrap">${label}</span></div>`;
}

export function segmented(items, { t = C } = {}) {
  return `<div style="display:flex;gap:4px;padding:4px;background:${t.sunken};border-radius:12px">
    ${items.map((i) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;
      min-height:38px;border-radius:8px;${i.on ? `background:${t.surface};${ELEV.sm}` : ''}">
      ${i.ic ? icon(i.ic, 15, i.on ? t.text : t.muted) : ''}
      <span style="${T.label};color:${i.on ? t.text : t.muted}">${i.label}</span></div>`).join('')}
  </div>`;
}

/** status: under | near | over | unset */
export function budgetBar(actual, cap, status, { label, planned, compact = false, note, t = C } = {}) {
  // The figures arrive pre-formatted ("₹6,650") because that is what the bar
  // must display; pull the number back out for the fill rather than asking
  // every caller to pass both forms.
  const num = (v) => Number(String(v).replace(/[^0-9.]/g, '')) || 0;
  const col = t[status] ?? t.unset;
  const a = num(actual), c = num(cap);
  const pct = status === 'unset' || !c ? 0 : Math.min(100, Math.round((a / c) * 100));
  const plannedPct = planned != null && c ? Math.min(100, (num(planned) / c) * 100) : null;
  const h = compact ? 6 : 10;
  const figures = status === 'unset'
    ? `<span style="${compact ? T.caption : T.label};color:${t.muted}">No budget set</span>`
    : `<span style="${compact ? T.caption : T.label};color:${compact ? t.muted : t.text};font-variant-numeric:tabular-nums">${actual} of ${cap}</span>`;
  return `<div style="display:flex;flex-direction:column;gap:4px">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      ${label ? `<span style="${T.label};color:${t.muted}">${label}</span>` : '<span></span>'}${figures}
    </div>
    <div style="height:${h}px;border-radius:999px;background:${t.sunken};overflow:hidden;position:relative">
      <div style="height:100%;width:${pct}%;background:${col};border-radius:999px"></div>
      ${plannedPct != null && plannedPct > 0 && plannedPct < 100
        ? `<div style="position:absolute;top:0;left:${plannedPct}%;width:2px;height:100%;background:${t.text};opacity:.35"></div>` : ''}
    </div>
    ${note ? `<div style="display:flex;align-items:center;gap:5px;margin-top:2px">
      ${icon('alert', 13, t.over)}<span style="${T.captionS};color:${t.over}">${note}</span></div>` : ''}
  </div>`;
}

export function budgetRing(pct, status, { size = 44, t = C } = {}) {
  const col = t[status] ?? t.unset;
  const r = (size - 4) / 2, cxy = size / 2, circ = 2 * Math.PI * r;
  const dash = status === 'unset' ? 0 : (Math.min(pct, 100) / 100) * circ;
  return `<div style="width:${size}px;height:${size}px;position:relative;flex:none;display:flex;align-items:center;justify-content:center">
    <svg width="${size}" height="${size}" style="position:absolute;transform:rotate(-90deg)">
      <circle cx="${cxy}" cy="${cxy}" r="${r}" stroke="${t.border}" stroke-width="4" fill="none"/>
      ${status !== 'unset' ? `<circle cx="${cxy}" cy="${cxy}" r="${r}" stroke="${col}" stroke-width="4" fill="none"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>` : ''}
    </svg>
    <span style="${T.captionS};color:${status === 'unset' ? t.faint : col};font-variant-numeric:tabular-nums">${status === 'unset' ? '—' : pct + '%'}</span>
  </div>`;
}

export function notice(body, { tone = 'info', title, ic, t = C } = {}) {
  const col = tone === 'danger' ? t.over : tone === 'warning' ? t.near : t.primary;
  const bg = tone === 'danger' ? t.overSoft : tone === 'warning' ? t.nearSoft : t.primarySoft;
  const def = tone === 'danger' ? 'alert' : tone === 'warning' ? 'warning' : 'info';
  return `<div style="display:flex;gap:12px;padding:12px;border-radius:12px;background:${bg}">
    ${icon(ic ?? def, 18, col)}
    <div style="flex:1;display:flex;flex-direction:column;gap:2px">
      ${title ? `<span style="${T.label};color:${col}">${title}</span>` : ''}
      <span style="${T.caption};color:${t.muted};line-height:18px">${body}</span>
    </div></div>`;
}

export function emptyState(ic, title, body, action, { t = C } = {}) {
  return `<div style="display:flex;flex-direction:column;align-items:center;padding:32px 24px;gap:0">
    <div style="width:56px;height:56px;border-radius:28px;background:${t.primarySoft};display:flex;
      align-items:center;justify-content:center;margin-bottom:16px">${icon(ic, 26, t.primary)}</div>
    <div style="${T.heading};color:${t.text};margin-bottom:4px">${title}</div>
    <div style="${T.body};color:${t.muted};text-align:center;text-wrap:pretty">${body}</div>
    ${action ? `<div style="margin-top:24px;align-self:stretch">${action}</div>` : ''}
  </div>`;
}

export function input(value, { placeholder, prefix, focus = false, multiline = false, t = C, style = '' } = {}) {
  const empty = !value;
  return `<div style="display:flex;align-items:${multiline ? 'flex-start' : 'center'};gap:6px;background:${t.surface};
    border:1px solid ${focus ? t.primary : t.border};border-radius:12px;padding:${multiline ? '12px' : '0 12px'};
    min-height:${multiline ? 72 : 48}px;${style}">
    ${prefix ? `<span style="${T.body};color:${t.muted}">${prefix}</span>` : ''}
    <span style="${T.body};color:${empty ? t.faint : t.text};${multiline ? '' : ''}">${empty ? placeholder : value}</span>
    ${focus ? `<span style="width:1.5px;height:20px;background:${t.primary};margin-left:1px"></span>` : ''}
  </div>`;
}

export function field(label, control, hint, { t = C } = {}) {
  return `<div style="display:flex;flex-direction:column;gap:8px">
    <span style="${T.label};color:${t.muted}">${label}</span>
    ${control}
    ${hint ? `<span style="${T.caption};color:${t.faint}">${hint}</span>` : ''}
  </div>`;
}

/** One itinerary row. */
export function stopCard(n, name, addr, meta, bar, { rating, t = C } = {}) {
  return `<div style="background:${t.surface};border:1px solid ${t.border};border-radius:16px;padding:16px;${ELEV.sm}">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:28px;height:28px;border-radius:14px;background:${t.primarySoft};display:flex;
        align-items:center;justify-content:center;flex:none">
        <span style="${T.captionS};color:${t.primary}">${n}</span></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0">
        <span style="${T.bodyS};color:${t.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span>
        <span style="${T.caption};color:${t.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${addr}</span>
        <span style="${T.caption};color:${t.faint};margin-top:2px">${meta}</span>
      </div>
      ${rating ? `<div style="display:flex;align-items:center;gap:3px;padding:3px 8px;border-radius:8px;background:${t.sunken};flex:none">
        ${iconFill('star', 11, t.near)}<span style="${T.captionS};color:${t.muted}">${rating}</span></div>` : ''}
      ${icon('reorder', 22, t.faint)}
    </div>
    <div style="margin-top:12px">${bar}</div>
  </div>`;
}

export function catTile(cat, { size = 34, t = C } = {}) {
  const col = t[cat];
  return `<div style="width:${size}px;height:${size}px;border-radius:8px;background:${col}18;display:flex;
    align-items:center;justify-content:center;flex:none">${icon(CAT_ICON[cat], 16, col)}</div>`;
}

export function listGroup(rows, { t = C } = {}) {
  return `<div style="background:${t.surface};border:1px solid ${t.border};border-radius:16px;overflow:hidden;${ELEV.sm}">
    ${rows.map((r, i) => `<div style="${i ? `border-top:1px solid ${t.border};` : ''}">${r}</div>`).join('')}</div>`;
}

export function fab({ bottom = 24, t = C } = {}) {
  return `<div style="position:absolute;right:16px;bottom:${bottom}px;width:58px;height:58px;border-radius:29px;
    background:${t.primary};display:flex;align-items:center;justify-content:center;${ELEV.lg}">
    ${icon('plus', 26, '#fff', 2.2)}</div>`;
}

/** The trip-total bar pinned above the gesture inset. */
export function stickyFooter(inner, { t = C } = {}) {
  return `<div style="position:absolute;left:0;right:0;bottom:0;background:${t.surface};
    border-top:1px solid ${t.border};padding:12px 16px ${12 + BOTTOM_INSET}px;display:flex;
    flex-direction:column;gap:8px;${ELEV.lg}">${inner}</div>`;
}

export function tabBar({ t = C } = {}) {
  return `<div style="position:absolute;left:0;right:0;bottom:0;background:${t.surface};border-top:1px solid ${t.border};
    padding:8px 0 ${8 + BOTTOM_INSET}px;display:flex;justify-content:center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      ${icon('map', 24, t.primary, 2)}<span style="${T.captionS};color:${t.primary}">Trips</span></div>
  </div>`;
}

export const INSET = BOTTOM_INSET;
export const GUTTER = G;

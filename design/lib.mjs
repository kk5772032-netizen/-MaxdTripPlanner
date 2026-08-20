/**
 * Shared vocabulary for the Waypoint design canvas.
 *
 * Values are lifted from src/theme.ts verbatim — this canvas has to be
 * indistinguishable from the shipped app, so nothing here is eyeballed or
 * rounded to a grid.
 */

export const C = {
  bg: '#F6F7F9', surface: '#FFFFFF', sunken: '#F2F4F7',
  border: '#E4E7EC', borderStrong: '#D0D5DD',
  text: '#0C111D', muted: '#5D6B82', faint: '#98A2B3', onPrimary: '#FFFFFF',
  primary: '#2563EB', primaryPressed: '#1D4FD7', primarySoft: '#EFF4FF',
  under: '#12B76A', near: '#F79009', over: '#F04438', unset: '#98A2B3',
  underSoft: '#ECFDF3', nearSoft: '#FFFAEB', overSoft: '#FEF3F2',
  food: '#DC6803', activity: '#2E90FA', transport: '#9E33D6',
  lodging: '#039855', other: '#8D97A5',
};

/** Dark theme from prompt X01 — re-derived, not inverted. */
export const D = {
  bg: '#0B0F17', surface: '#141A24', sunken: '#1C232F',
  border: '#263041', borderStrong: '#334054',
  text: '#F2F5F9', muted: '#9AA8BD', faint: '#6B7A90', onPrimary: '#FFFFFF',
  primary: '#4E86F7', primaryPressed: '#3D72E0', primarySoft: '#16233C',
  under: '#2BC77F', near: '#FDB022', over: '#FF6B5E', unset: '#6B7A90',
  underSoft: '#10251C', nearSoft: '#2A1F0C', overSoft: '#2B1512',
  food: '#F79009', activity: '#63A6FF', transport: '#C07DEE',
  lodging: '#2BC77F', other: '#97A2B2',
};

export const FONT =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** The type scale, as inline style strings. */
export const T = {
  display: 'font-size:30px;line-height:36px;font-weight:700;letter-spacing:-0.5px',
  hero:    'font-size:34px;line-height:40px;font-weight:700;letter-spacing:-0.8px',
  title:   'font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.3px',
  heading: 'font-size:17px;line-height:22px;font-weight:600;letter-spacing:-0.2px',
  body:    'font-size:15px;line-height:21px;font-weight:400',
  bodyS:   'font-size:15px;line-height:21px;font-weight:600',
  label:   'font-size:13px;line-height:18px;font-weight:600',
  caption: 'font-size:12px;line-height:16px;font-weight:400',
  captionS:'font-size:12px;line-height:16px;font-weight:600',
  amount:  'font-size:15px;line-height:20px;font-weight:700;letter-spacing:-0.2px;font-variant-numeric:tabular-nums',
};

export const ELEV = {
  sm: 'box-shadow:0 2px 6px rgba(12,17,29,.04)',
  md: 'box-shadow:0 4px 12px rgba(12,17,29,.07)',
  lg: 'box-shadow:0 8px 20px rgba(12,17,29,.12)',
};

/** Stroke icons on a 24 grid. Emoji and dingbats are never used as icons. */
const P = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  location: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  map: '<path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6l5-2Z"/><path d="M9 4v14M15 6v14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  receipt: '<path d="M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21V3Z"/><path d="M9 8h6M9 12h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3"/><rect x="3" y="8" width="18" height="12" rx="2.5"/><circle cx="16.5" cy="14" r="1.3"/>',
  food: '<path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M18 3c-1.6 1.2-2.4 3-2.4 5.4 0 1.6.8 2.6 2.4 2.6V3ZM18 11v10"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.4-5.6L9.5 13l.8-4.4 3.2-1 2.3 3 2.7 1.2M11.4 15.4 15 17l1.6 4"/>',
  car: '<path d="M4 16v3M20 16v3"/><path d="M3 16v-3.5L5 7h14l2 5.5V16H3Z"/><circle cx="7.5" cy="16" r="1.4"/><circle cx="16.5" cy="16" r="1.4"/>',
  bed: '<path d="M3 18V6M3 12h18v6M21 18v-4"/><circle cx="8" cy="10" r="2"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 5v6h-6"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  warning: '<path d="M12 4 2.8 20h18.4L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c4 4.6 4 12.4 0 17-4-4.6-4-12.4 0-17Z"/>',
  share: '<path d="M12 15V4M8.5 7.5 12 4l3.5 3.5"/><path d="M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6"/>',
  reorder: '<path d="M4 9h16M4 15h16"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  cloudOff: '<path d="M3 3l18 18"/><path d="M7.5 18h9.2a3.8 3.8 0 0 0 .9-7.5A6 6 0 0 0 8.6 7.7"/><path d="M5.4 9.6A3.8 3.8 0 0 0 6 18"/>',
  undo: '<path d="M4 9h9.5a5.5 5.5 0 1 1 0 11H7"/><path d="M8 5 4 9l4 4"/>',
  pin: '<path d="M12 21s6-5 6-10a6 6 0 1 0-12 0c0 5 6 10 6 10Z"/>',
};

export function icon(name, size = 20, color = 'currentColor', sw = 1.7) {
  const d = P[name];
  if (!d) throw new Error('unknown icon: ' + name);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${d}</svg>`;
}

/** Solid-filled variant, for pins and rating stars. */
export function iconFill(name, size = 20, color = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="none" aria-hidden="true" style="flex:none">${P[name]}</svg>`;
}

export const CAT_ICON = {
  food: 'food', activity: 'walk', transport: 'car', lodging: 'bed', other: 'dots',
};

/** Wraps a body in the Design Component envelope. */
export function dc(body, { bg = C.bg, fg = C.text, w = 390, h = 844, extraCss = '' } = {}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body { margin: 0; font-family: ${FONT}; -webkit-font-smoothing: antialiased; }
    a { color: ${C.primary}; text-decoration: none; }
    a:hover { color: ${C.primaryPressed}; }
    * { box-sizing: border-box; }
    ${extraCss}
  </style>
</helmet>
<div style="width:${w}px;height:${h}px;background:${bg};color:${fg};position:relative;overflow:hidden;display:flex;flex-direction:column">
${body}
</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

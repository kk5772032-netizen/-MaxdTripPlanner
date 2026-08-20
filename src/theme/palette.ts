/**
 * The two palettes.
 *
 * Dark is re-derived, not inverted: the primary lifts so it still holds
 * contrast on a dark ground, status colours are re-picked for the same reason,
 * and elevation becomes surface lightness because a shadow is invisible on
 * dark. Every key exists in both, so a component is written against the shape
 * without caring which is active.
 */

export interface Palette {
  scheme: 'light' | 'dark';

  bg: string;
  surface: string;
  surfaceSunken: string;
  /**
   * The selected pill inside a sunken track. On white it can just be the card
   * surface; in dark that would be *darker* than the track it sits in, which
   * reads as the unselected half — so raised is its own step, always lighter
   * than sunken.
   */
  surfaceRaised: string;
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textFaint: string;
  textOnPrimary: string;

  primary: string;
  primaryPressed: string;
  primarySoft: string;
  /**
   * Grounds that carry `textOnPrimary` — filled buttons, the FAB, map pins,
   * the recap hero. Deliberately not the same token as `primary`: a blue light
   * enough to read as a link on the dark ground is too light to carry white
   * text, so the fill stays darker than the tint in dark mode.
   */
  accent: string;
  accentPressed: string;
  dangerFill: string;
  dangerFillPressed: string;

  under: string;
  near: string;
  over: string;
  unset: string;
  underSoft: string;
  nearSoft: string;
  overSoft: string;
  /**
   * The same four states as text rather than as fill. A green bright enough to
   * read as a bar on white is too light to read as a word on white, so the
   * text weights are darkened separately in light mode; in dark mode the fills
   * already sit well clear of the ground and the two coincide.
   */
  underText: string;
  nearText: string;
  overText: string;
  unsetText: string;

  overlay: string;
  /** Light-on-dark accent for the toast action, which sits on its own ground. */
  onDarkAccent: string;

  categories: Record<string, string>;
}

export const lightPalette: Palette = {
  scheme: 'light',
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceSunken: '#F2F4F7',
  surfaceRaised: '#FFFFFF',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',
  text: '#0C111D',
  // Both muted levels are darker than they look like they need to be: at
  // #98A2B3 the faint level measured 2.4:1 on the app ground, well under the
  // 4.5:1 that body text needs, however light and airy it looked.
  textMuted: '#475467',
  textFaint: '#626D80',
  textOnPrimary: '#FFFFFF',
  primary: '#2563EB',
  primaryPressed: '#1D4FD7',
  primarySoft: '#EFF4FF',
  accent: '#2563EB',
  accentPressed: '#1D4FD7',
  dangerFill: '#D92D20',
  dangerFillPressed: '#B42318',
  under: '#099250',
  near: '#DC6803',
  over: '#F04438',
  unset: '#98A2B3',
  underSoft: '#ECFDF3',
  nearSoft: '#FFFAEB',
  overSoft: '#FEF3F2',
  underText: '#067647',
  nearText: '#B54708',
  overText: '#B42318',
  unsetText: '#667085',
  overlay: 'rgba(12, 17, 29, 0.45)',
  onDarkAccent: '#93B4FD',
  categories: {
    food: '#DC6803',
    activity: '#2E90FA',
    transport: '#9E33D6',
    lodging: '#039855',
    other: '#7A8595',
  },
};

export const darkPalette: Palette = {
  scheme: 'dark',
  bg: '#0B0F17',
  surface: '#141A24',
  surfaceSunken: '#1C232F',
  surfaceRaised: '#2E3A4A',
  border: '#263041',
  borderStrong: '#334054',
  text: '#F2F5F9',
  textMuted: '#9AA8BD',
  textFaint: '#7B8AA1',
  textOnPrimary: '#FFFFFF',
  primary: '#4E86F7',
  primaryPressed: '#3D72E0',
  primarySoft: '#16233C',
  accent: '#2F5FD0',
  accentPressed: '#2951B8',
  dangerFill: '#D93A2B',
  dangerFillPressed: '#BC2E21',
  under: '#2BC77F',
  near: '#FDB022',
  over: '#FF6B5E',
  unset: '#6B7A90',
  underSoft: '#10251C',
  nearSoft: '#2A1F0C',
  overSoft: '#2B1512',
  underText: '#2BC77F',
  nearText: '#FDB022',
  overText: '#FF6B5E',
  unsetText: '#9AA8BD',
  overlay: 'rgba(0, 0, 0, 0.6)',
  onDarkAccent: '#93B4FD',
  categories: {
    food: '#F79009',
    activity: '#63A6FF',
    transport: '#C07DEE',
    lodging: '#2BC77F',
    other: '#97A2B2',
  },
};

export function statusColorOf(p: Palette, status: string): string {
  return status === 'under' ? p.under
    : status === 'near' ? p.near
    : status === 'over' ? p.over
    : p.unset;
}

/** The status colour to render words in — see the *Text tokens above. */
export function statusTextOf(p: Palette, status: string): string {
  return status === 'under' ? p.underText
    : status === 'near' ? p.nearText
    : status === 'over' ? p.overText
    : p.unsetText;
}

export function statusSoftOf(p: Palette, status: string): string {
  return status === 'under' ? p.underSoft
    : status === 'near' ? p.nearSoft
    : status === 'over' ? p.overSoft
    : p.surfaceSunken;
}

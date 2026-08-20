import { darkPalette, lightPalette, type Palette } from './palette';

/**
 * Contrast is a property of the palette, not of any one screen, so it is
 * checked here once for both themes rather than screen by screen. The pairs
 * below are the ones the app actually renders — a token combination that
 * appears nowhere isn't worth defending.
 *
 * Thresholds are WCAG 2.1 AA: 4.5:1 for text, 3:1 for the graphics you have to
 * read to understand the screen (a budget bar, a status arc, a pie slice).
 */

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;

const pairs: [keyof Palette, keyof Palette, number][] = [
  ['text', 'bg', TEXT],
  ['text', 'surface', TEXT],
  ['textMuted', 'bg', TEXT],
  ['textMuted', 'surface', TEXT],
  ['textFaint', 'bg', TEXT],
  ['textFaint', 'surface', TEXT],
  // primary is the link/icon tint on the app's own ground…
  ['primary', 'bg', TEXT],
  ['primary', 'surface', TEXT],
  // …while accent is the ground under white text, which is why they differ.
  ['textOnPrimary', 'accent', TEXT],
  ['textOnPrimary', 'accentPressed', TEXT],
  ['textOnPrimary', 'dangerFill', TEXT],
  ['textOnPrimary', 'dangerFillPressed', TEXT],
  ['accent', 'bg', GRAPHIC],
  ['dangerFill', 'bg', GRAPHIC],
  // Status as words, on both grounds it appears on.
  ['underText', 'surface', TEXT],
  ['nearText', 'surface', TEXT],
  ['overText', 'surface', TEXT],
  ['unsetText', 'surface', TEXT],
  ['underText', 'underSoft', TEXT],
  ['nearText', 'nearSoft', TEXT],
  ['overText', 'overSoft', TEXT],
  // Status as fill: bars and arcs, against the track they sit in.
  ['under', 'surfaceSunken', GRAPHIC],
  ['near', 'surfaceSunken', GRAPHIC],
  ['over', 'surfaceSunken', GRAPHIC],
];

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
])('%s palette', (_name, palette) => {
  it.each(pairs)('%s on %s clears %s:1', (fg, bg, min) => {
    expect(contrast(palette[fg] as string, palette[bg] as string)).toBeGreaterThanOrEqual(min);
  });

  // Pie slices and legend swatches, which carry meaning by colour alone.
  it.each(Object.keys(lightPalette.categories))('category %s clears 3:1 on surface', (key) => {
    expect(contrast(palette.categories[key], palette.surface)).toBeGreaterThanOrEqual(GRAPHIC);
  });

  it('keeps a selected pill visible against the track it sits in', () => {
    // The defect this guards against is inversion — a "selected" pill that
    // sits darker than its track and so reads as the unselected half. The
    // margin only has to be enough to see; a shadow does the rest.
    expect(relativeLuminance(palette.surfaceRaised)).toBeGreaterThan(
      relativeLuminance(palette.surfaceSunken),
    );
    expect(contrast(palette.surfaceRaised, palette.surfaceSunken)).toBeGreaterThan(1.08);
    expect(contrast(palette.text, palette.surfaceRaised)).toBeGreaterThanOrEqual(TEXT);
  });

  it('keeps three text levels that read as a hierarchy', () => {
    const [strong, muted, faint] = [palette.text, palette.textMuted, palette.textFaint].map(
      relativeLuminance,
    );
    // Each level recedes from the last — towards the ground, whichever way
    // that is — by enough to be seen as a step rather than a rendering artefact.
    if (palette.scheme === 'dark') {
      expect(strong).toBeGreaterThan(muted);
      expect(muted).toBeGreaterThan(faint);
    } else {
      expect(strong).toBeLessThan(muted);
      expect(muted).toBeLessThan(faint);
    }
    expect(contrast(palette.text, palette.textMuted)).toBeGreaterThan(1.8);
    expect(contrast(palette.textMuted, palette.textFaint)).toBeGreaterThan(1.2);
  });
});

/**
 * Status and category are two independent vocabularies that meet on the
 * dashboard — an amber trip bar sits directly above an orange Food slice. They
 * do not have to be far apart in hue (amber and orange are neighbours), but
 * they must not be the same value, or the two readings look related.
 */
describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
])('%s palette keeps status and category apart', (_name, palette) => {
  const statuses = ['under', 'near', 'over'] as const;
  it.each(statuses)('%s is not identical to any category colour', (status) => {
    expect(Object.values(palette.categories)).not.toContain(palette[status]);
  });
});

import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

import { bookingIcons, bookingLabels, categoryIcons } from './tokens';

/**
 * A misspelt Ionicons name does not throw. It renders an empty box, or on some
 * platforms a tofu glyph, and looks like a layout bug rather than a typo — so
 * it survives review and ships. These maps are the app's whole icon vocabulary,
 * so they are cheap to check and expensive to get wrong.
 */

const known = new Set(Object.keys(glyphs));

describe('icon names', () => {
  it.each(Object.entries(categoryIcons))('category %s uses a real icon (%s)', (_key, name) => {
    expect(known.has(name)).toBe(true);
  });

  it.each(Object.entries(bookingIcons))('booking %s uses a real icon (%s)', (_key, name) => {
    expect(known.has(name)).toBe(true);
  });

  it('gives every booking kind both an icon and a label', () => {
    // The two maps are read side by side; one growing without the other shows
    // up as a nameless row or an iconless one.
    expect(Object.keys(bookingIcons).sort()).toEqual(Object.keys(bookingLabels).sort());
  });
});

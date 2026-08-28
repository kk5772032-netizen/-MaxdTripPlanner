import { createContext, useContext, useMemo } from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useSettingsStore } from '../state/settingsStore';
import { darkPalette, lightPalette, type Palette } from './palette';

export * from './palette';
export {
  elevation, radius, spacing, type,
  HIT_SLOP, MIN_TAP, bookingIcons, bookingLabels, categoryIcons, categoryLabels,
} from '../tokens';

const ThemeContext = createContext<Palette>(lightPalette);

/**
 * Resolves the active palette: the user's explicit choice, or the OS when they
 * haven't made one.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSettingsStore((s) => s.theme);
  const os = useColorScheme();
  const palette = useMemo(() => {
    const scheme = preference === 'system' ? os ?? 'light' : preference;
    return scheme === 'dark' ? darkPalette : lightPalette;
  }, [preference, os]);

  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Builds one stylesheet per palette.
 *
 * StyleSheet.create bakes its values once, so a themed screen cannot hold a
 * module-level stylesheet. This keeps that shape — `const styles = useStyles()`
 * inside the component — while producing a sheet per palette rather than per
 * render. There are only ever two palettes, so the cache stays at two entries.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<unknown>>(
  // Mirrors StyleSheet.create's own signature, so style literals keep their
  // narrow types ('center' stays 'center' rather than widening to string).
  factory: (t: Palette) => T & NamedStyles<T>,
): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles(): T {
    const palette = useTheme();
    let sheet = cache.get(palette);
    if (!sheet) {
      sheet = StyleSheet.create(factory(palette));
      cache.set(palette, sheet);
    }
    return sheet;
  };
}

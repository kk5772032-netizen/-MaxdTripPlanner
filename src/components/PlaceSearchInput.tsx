import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PlacesError, autocomplete, hasApiKey, newSessionToken } from '../api/places';
import { Notice } from './ui';
import { colors, radius, spacing, type } from '../theme';
import type { PlaceSuggestion } from '../types';

const DEBOUNCE_MS = 300;

/**
 * Places autocomplete field.
 *
 * Two things keep the bill down: a 300 ms debounce so a burst of keystrokes is
 * one request, and a session token that lives from mount until a selection is
 * made, so Google bills the flow at the session rate. After a selection the
 * token is rotated — reusing one across two selections silently drops you back
 * to per-request billing.
 */
export function PlaceSearchInput({
  placeholder = 'Search for a place',
  onSelect,
  autoFocus,
}: {
  placeholder?: string;
  onSelect: (suggestion: PlaceSuggestion, sessionToken: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionToken = useRef(newSessionToken());
  const abortRef = useRef<AbortController | null>(null);
  const keyMissing = useMemo(() => !hasApiKey(), []);

  useEffect(() => {
    if (keyMissing) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      autocomplete(trimmed, { sessionToken: sessionToken.current, signal: controller.signal })
        .then((results) => {
          if (controller.signal.aborted) return;
          setSuggestions(results);
          setError(null);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setError(
            e instanceof PlacesError ? e.message : 'Search failed. Try again in a moment.',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, keyMissing]);

  // Abort any request still in flight when the field unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const select = (suggestion: PlaceSuggestion) => {
    const token = sessionToken.current;
    // Rotate before handing off: the Details call the caller makes closes this
    // session, and the next search must start a new one.
    sessionToken.current = newSessionToken();
    setQuery('');
    setSuggestions([]);
    onSelect(suggestion, token);
  };

  if (keyMissing) {
    return (
      <Notice
        tone="info"
        icon="search-outline"
        title="Place search is off"
        body="Set EXPO_PUBLIC_GOOGLE_PLACES_KEY in .env to search real places. You can still add stops by typing them below."
      />
    );
  }

  return (
    <View>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={17} color={colors.textFaint} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
        />
        {loading ? <ActivityIndicator style={styles.spinner} color={colors.textFaint} /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {suggestions.length > 0 ? (
        <View style={styles.dropdown}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.placeId}
              accessibilityRole="button"
              onPress={() => select(suggestion)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowPrimary} numberOfLines={1}>
                {suggestion.primaryText}
              </Text>
              {suggestion.secondaryText ? (
                <Text style={styles.rowSecondary} numberOfLines={1}>
                  {suggestion.secondaryText}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { justifyContent: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingLeft: 40,
    paddingRight: 40,
    minHeight: 48,
    ...type.body,
    color: colors.text,
  },
  searchIcon: { position: 'absolute', left: spacing.md, zIndex: 1 },
  spinner: { position: 'absolute', right: spacing.md },
  error: { ...type.caption, color: colors.over, marginTop: spacing.sm },
  dropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 56, justifyContent: 'center' },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.primarySoft },
  rowPrimary: { ...type.bodyStrong, color: colors.text },
  rowSecondary: { ...type.caption, color: colors.textMuted, marginTop: 1 },

});

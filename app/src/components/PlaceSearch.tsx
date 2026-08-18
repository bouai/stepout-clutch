import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { apiRequest } from '../api';
import { colors, radius, spacing } from '../theme';

export interface Place {
  name: string;
  context: string;
  latitude: number;
  longitude: number;
}

interface PlaceSearchProps {
  onSelect: (place: Place) => void;
  placeholder?: string;
  /** Biases results toward the user, so "airport" means the nearby one. */
  near?: { latitude: number; longitude: number } | null;
  /** Keystroke settle time before searching. Zero in tests. */
  debounceMs?: number;
  testIDPrefix?: string;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

/**
 * Search-as-you-type place lookup.
 *
 * Destinations and geofence zones could previously only be created by tapping
 * a map and accepting whatever coordinate landed under your finger, which is
 * not a realistic way to add somewhere you actually go.
 */
export default function PlaceSearch({
  onSelect,
  placeholder = 'Search for a place',
  near,
  debounceMs = DEBOUNCE_MS,
  testIDPrefix = 'place-search',
}: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');

  // Guards against a slow earlier request landing after a faster later one and
  // repainting the list with stale results.
  const requestId = useRef(0);

  // A request in flight when the field unmounts would otherwise resolve into a
  // torn-down tree and set state on it.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const search = useCallback(
    async (text: string) => {
      const id = ++requestId.current;
      setStatus('loading');

      try {
        const places = await apiRequest<Place[]>('/places', {
          query: {
            q: text,
            lat: near?.latitude ?? null,
            lon: near?.longitude ?? null,
          },
        });
        if (!mounted.current || id !== requestId.current) return;

        setResults(places);
        setStatus(places.length === 0 ? 'empty' : 'idle');
      } catch {
        if (!mounted.current || id !== requestId.current) return;
        setResults([]);
        setStatus('error');
      }
    },
    [near?.latitude, near?.longitude]
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      requestId.current += 1;
      setResults([]);
      setStatus('idle');
      return;
    }

    // Debounced so a free public geocoder isn't hit on every keystroke.
    const timer = setTimeout(() => search(trimmed), debounceMs);
    return () => clearTimeout(timer);
  }, [query, search, debounceMs]);

  function choose(place: Place) {
    onSelect(place);
    setQuery('');
    setResults([]);
    setStatus('idle');
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          testID={`${testIDPrefix}-input`}
        />
        {status === 'loading' && (
          <ActivityIndicator
            style={styles.spinner}
            testID={`${testIDPrefix}-loading`}
          />
        )}
      </View>

      {status === 'error' && (
        <Text style={styles.error} testID={`${testIDPrefix}-error`}>
          Could not search right now.
        </Text>
      )}

      {status === 'empty' && (
        <Text style={styles.empty} testID={`${testIDPrefix}-empty`}>
          No places matched that.
        </Text>
      )}

      {results.length > 0 && (
        <ScrollView
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          testID={`${testIDPrefix}-results`}
        >
          {results.map((place, index) => (
            <Pressable
              key={`${place.name}-${place.latitude}-${place.longitude}-${index}`}
              style={styles.result}
              onPress={() => choose(place)}
              testID={`${testIDPrefix}-result-${index}`}
            >
              <Text style={styles.resultName}>{place.name}</Text>
              {place.context.length > 0 && (
                <Text style={styles.resultContext}>{place.context}</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardTranslucentBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    // A solid frosted field so the dark input text reads whether this sits on
    // the gradient (Transit / Tracking) or inside a white modal (trip setup).
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  spinner: {
    position: 'absolute',
    right: spacing.md,
  },
  results: {
    maxHeight: 220,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  result: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  resultName: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  resultContext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
  empty: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppBackground from '../../components/AppBackground';
import GlassCard from '../../components/GlassCard';
import PlaceSearch from '../../components/PlaceSearch';
import { Button, Chip, TextField, Toggle } from '../../components/ui';
import { apiRequest } from '../../api';
import { useTripContext, type TripCoords } from '../../context/TripContext';
import type { InventoryItem, TripType, Weather } from '../../types/models';
import { colors, radius, spacing } from '../../theme';

type Step = 'welcome' | 'trip' | 'packing' | 'place' | 'done';
const ORDER: Step[] = ['welcome', 'trip', 'packing', 'place', 'done'];

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'commute', label: 'Commute' },
  { value: 'day-trip', label: 'Day trip' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'business', label: 'Business' },
  { value: 'flight', label: 'Flight' },
  { value: 'other', label: 'Other' },
];

interface Props {
  onComplete: () => void;
}

/**
 * A guided, configuring first run. Rather than a marketing carousel, each step
 * actually sets the app up: it creates the user's first (Office) trip, shows the
 * packing list StepOut generated for it, optionally saves the destination as a
 * place, and ends on the "it thinks ahead for me" payoff. Every step can be
 * skipped without losing the work already done.
 */
export default function OnboardingFlow({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { createTrip } = useTripContext();

  const [step, setStep] = useState<Step>('welcome');

  const [name, setName] = useState('Office');
  const [tripType, setTripType] = useState<TripType>('commute');
  const [coords, setCoords] = useState<TripCoords | null>(null);
  const [isRecurring, setIsRecurring] = useState(true);
  const [locating, setLocating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tripId, setTripId] = useState<number | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [placeSaved, setPlaceSaved] = useState(false);
  const [savingPlace, setSavingPlace] = useState(false);

  const stepIndex = ORDER.indexOf(step);

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location is off — you can add a place later.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync();
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setError('Could not read your location.');
    } finally {
      setLocating(false);
    }
  }

  async function createFirstTrip() {
    const trimmed = name.trim() || 'Office';
    setCreating(true);
    setError(null);
    const result = await createTrip(trimmed, {
      coords: coords ?? undefined,
      tripType,
      isRecurring,
    });
    if (!result) {
      setError('Could not create your trip. Please try again.');
      setCreating(false);
      return;
    }
    setTripId(result.trip.id);

    // Pull the generated packing list + weather for the preview and payoff.
    try {
      const inv = await apiRequest<InventoryItem[]>(
        `/inventory-items?tripId=${result.trip.id}`
      );
      setItems(inv);
    } catch {
      setItems([]);
    }
    if (coords) {
      try {
        const w = await apiRequest<Weather>('/weather', {
          query: { lat: coords.latitude, lon: coords.longitude },
        });
        setWeather(w);
      } catch {
        // Weather is a nicety here, not required.
      }
    }
    setCreating(false);
    go('packing');
  }

  async function savePlace() {
    if (!coords || tripId === null) {
      go('done');
      return;
    }
    setSavingPlace(true);
    try {
      await apiRequest('/saved-destinations', {
        method: 'POST',
        body: {
          label: name.trim() || 'Office',
          latitude: coords.latitude,
          longitude: coords.longitude,
          tripId,
        },
      });
      setPlaceSaved(true);
    } catch {
      // Non-fatal; the user can add a place from the Map tab.
    } finally {
      setSavingPlace(false);
    }
    go('done');
  }

  const umbrella = items.find((i) => /umbrella/i.test(i.name));

  return (
    <AppBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.topBar}>
          <View style={styles.dots}>
            {ORDER.map((s, i) => (
              <View key={s} style={[styles.dot, i <= stepIndex && styles.dotActive]} />
            ))}
          </View>
          {step !== 'done' && (
            <Pressable onPress={onComplete} testID="onboarding-skip-button" hitSlop={8}>
              <Text style={styles.skip}>Skip setup</Text>
            </Pressable>
          )}
        </View>

        {step === 'welcome' && (
          <View style={styles.body}>
            <View style={styles.hero}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoGlyph}>🧭</Text>
              </View>
              <Text style={styles.title}>Welcome to StepOut</Text>
              <Text style={styles.lead}>
                StepOut thinks ahead so you don't have to — what to take, when to leave, and
                what you might forget.
              </Text>
              <Text style={styles.leadSub}>
                Let's set up your first trip. It takes about a minute.
              </Text>
            </View>
            <Button
              label="Get started"
              onPress={() => go('trip')}
              testID="onboarding-get-started-button"
            />
          </View>
        )}

        {step === 'trip' && (
          <View style={styles.body}>
            <Text style={styles.stepKicker}>Step 1 · Your first trip</Text>
            <Text style={styles.title}>Let's start with your commute</Text>
            <Text style={styles.lead}>
              Work is the trip you take most — StepOut will set it up for you.
            </Text>

            <GlassCard style={styles.formCard}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Trip name</Text>
                <TextField value={name} onChangeText={setName} placeholder="Office" testID="onb-trip-name" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.typeGrid}>
                  {TRIP_TYPES.map((t) => (
                    <Chip
                      key={t.value}
                      label={t.label}
                      selected={tripType === t.value}
                      onPress={() => setTripType(t.value)}
                      testID={`onb-type-${t.value}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Where is it? (optional)</Text>
                {coords ? (
                  <View style={styles.locationChosen}>
                    <Text style={styles.locationText}>
                      📍 {coords.locationName ??
                        `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`}
                    </Text>
                    <Pressable onPress={() => setCoords(null)}>
                      <Text style={styles.changeText}>Change</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <PlaceSearch
                      placeholder="Search your office address"
                      onSelect={(place) =>
                        setCoords({
                          latitude: place.latitude,
                          longitude: place.longitude,
                          locationName: place.context
                            ? `${place.name}, ${place.context}`
                            : place.name,
                        })
                      }
                      testIDPrefix="onb-place-search"
                    />
                    <Pressable
                      style={styles.currentLocBtn}
                      onPress={useCurrentLocation}
                      disabled={locating}
                    >
                      {locating ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={styles.locationText}>📍 Use my current location</Text>
                      )}
                    </Pressable>
                    <Text style={styles.hint}>
                      A location unlocks weather-based packing and arrival alerts.
                    </Text>
                  </>
                )}
              </View>

              <View style={styles.recurringRow}>
                <View style={styles.recurringText}>
                  <Text style={styles.recurringLabel}>🔁 Repeats daily</Text>
                  <Text style={styles.hint}>Resets your checklist each morning.</Text>
                </View>
                <Toggle value={isRecurring} onValueChange={setIsRecurring} testID="onb-recurring" />
              </View>
            </GlassCard>

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label={creating ? 'Setting up…' : `Create my ${name.trim() || 'Office'} trip`}
              onPress={createFirstTrip}
              loading={creating}
              testID="onboarding-create-trip-button"
            />
          </View>
        )}

        {step === 'packing' && (
          <View style={styles.body}>
            <Text style={styles.stepKicker}>Step 2 · Done for you</Text>
            <Text style={styles.title}>StepOut packed your list</Text>
            <Text style={styles.lead}>
              Based on a {tripType} trip{weather ? ` and ${weather.condition} in the forecast` : ''},
              here's what it added — {items.length} item{items.length === 1 ? '' : 's'} to pack.
            </Text>

            <GlassCard style={styles.listCard}>
              {items.length === 0 ? (
                <Text style={styles.lead}>Your list is ready in the Inventory tab.</Text>
              ) : (
                items.map((item) => (
                  <View key={item.id} style={styles.previewRow}>
                    <Text style={styles.previewCheck}>✓</Text>
                    <Text style={styles.previewName}>{item.name}</Text>
                    {umbrella && item.id === umbrella.id && (
                      <View style={styles.weatherTag}>
                        <Text style={styles.weatherTagText}>for rain</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </GlassCard>
            <Text style={styles.hint}>You can tweak this any time in Planner and Inventory.</Text>

            <Button label="Looks good" onPress={() => go('place')} testID="onboarding-packing-next" />
          </View>
        )}

        {step === 'place' && (
          <View style={styles.body}>
            <Text style={styles.stepKicker}>Step 3 · Make it proactive</Text>
            <Text style={styles.title}>Get alerts when you arrive & leave</Text>
            <Text style={styles.lead}>
              Save {name.trim() || 'Office'} as a place and StepOut can nudge you the moment you
              get there or head home — no timers to set.
            </Text>

            <GlassCard style={styles.formCard}>
              {coords ? (
                <>
                  <Text style={styles.locationText}>
                    📍 {coords.locationName ??
                      `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`}
                  </Text>
                  <Button
                    label={savingPlace ? 'Saving…' : `Save ${name.trim() || 'Office'} as a place`}
                    onPress={savePlace}
                    loading={savingPlace}
                    testID="onboarding-save-place"
                  />
                </>
              ) : (
                <Text style={styles.lead}>
                  Your trip has no location yet — you can add places any time from the Map tab.
                </Text>
              )}
            </GlassCard>

            <Button
              label={coords ? 'Not now' : 'Continue'}
              variant="ghost"
              onPress={() => go('done')}
              testID="onboarding-place-skip"
            />
          </View>
        )}

        {step === 'done' && (
          <View style={styles.body}>
            <View style={styles.hero}>
              <Text style={styles.bigEmoji}>{weather?.condition === 'rain' ? '🌧' : '✨'}</Text>
              <Text style={styles.title}>You're ready for tomorrow</Text>
            </View>

            <GlassCard style={styles.summaryCard} tone="hero">
              <Text style={styles.summaryTrip}>
                {name.trim() || 'Office'}
                {isRecurring ? ' · repeats daily' : ''}
              </Text>
              {weather && (
                <Text style={styles.summaryLine}>
                  🌡 {Math.round(weather.temperatureCelsius)}° · {weather.condition}
                  {umbrella ? ' — umbrella added to your list' : ''}
                </Text>
              )}
              <Text style={styles.summaryLine}>🎒 {items.length} items to pack</Text>
              {placeSaved && <Text style={styles.summaryLine}>📍 Arrival alerts on for {name.trim() || 'Office'}</Text>}
            </GlassCard>

            <Text style={styles.lead}>
              That's the idea — StepOut looks ahead so you don't have to. Everything's on your
              Home screen now.
            </Text>

            <Button label="Enter StepOut" onPress={onComplete} testID="onboarding-finish-button" />
          </View>
        )}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.chipIdleBorder,
  },
  dotActive: { backgroundColor: colors.accent, width: 18 },
  skip: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoGlyph: { fontSize: 34 },
  bigEmoji: { fontSize: 56 },
  stepKicker: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  lead: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  leadSub: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  formCard: { padding: spacing.md, gap: spacing.md },
  listCard: { padding: spacing.md, gap: 2 },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.sectionLabel,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { fontSize: 12, color: colors.textTertiary },
  currentLocBtn: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.chipIdleBg,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  locationChosen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  locationText: { color: colors.textPrimary, fontWeight: '600' },
  changeText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recurringText: { flex: 1, gap: 2 },
  recurringLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  previewCheck: { color: colors.accent, fontWeight: '900', fontSize: 15 },
  previewName: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  weatherTag: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  weatherTagText: { fontSize: 11, fontWeight: '700', color: colors.navIconActive },
  summaryCard: { padding: spacing.lg, gap: spacing.sm },
  summaryTrip: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  summaryLine: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  error: { color: colors.danger, textAlign: 'center' },
});

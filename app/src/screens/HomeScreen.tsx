import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import ProgressRing from '../components/ProgressRing';
import ScreenContainer from '../components/ScreenContainer';
import SettingsSheet from '../components/SettingsSheet';
import TripSwitcher from '../components/TripSwitcher';
import { apiRequest, describeError } from '../api';
import { useTripContext } from '../context/TripContext';
import type {
  ChecklistItem,
  Distance,
  GeofenceEvent,
  GeofenceTrigger,
  InventoryItem,
  SavedDestination,
  Weather,
} from '../types/models';
import { cardShadow, colors, radius, spacing } from '../theme';
import { formatRelativeTime } from '../utils/time';

const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;

type WeatherStatus = 'loading' | 'ready' | 'unavailable';
type ProgressStatus = 'loading' | 'ready';
type NearestStatus = 'loading' | 'ready' | 'empty' | 'error';
type AlertStatus = 'loading' | 'ready' | 'empty' | 'error';

interface NearestDestination {
  destination: SavedDestination;
  distance: Distance;
}

const CONDITION_COPY: Record<string, string> = {
  rain: 'Rain expected today',
  snow: 'Snow expected today',
  'extreme-heat': 'Extreme heat today',
  'extreme-cold': 'Extreme cold today',
  wind: 'Windy today',
  clear: 'Clear today',
};

interface LatestAlert {
  event: GeofenceEvent;
  triggerLabel: string;
}

async function resolveCoordinates(): Promise<{
  latitude: number;
  longitude: number;
  usedDefault: boolean;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        latitude: DEFAULT_LATITUDE,
        longitude: DEFAULT_LONGITUDE,
        usedDefault: true,
      };
    }
    const position = await Location.getCurrentPositionAsync();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      usedDefault: false,
    };
  } catch {
    return {
      latitude: DEFAULT_LATITUDE,
      longitude: DEFAULT_LONGITUDE,
      usedDefault: true,
    };
  }
}

export default function HomeScreen() {
  const { trips, currentTripId, refreshTrips } = useTripContext();
  const currentTrip = trips.find((trip) => trip.id === currentTripId) ?? null;

  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('loading');
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [usedDefaultLocation, setUsedDefaultLocation] = useState(false);

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistStatus, setChecklistStatus] = useState<ProgressStatus>('loading');

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryStatus, setInventoryStatus] = useState<ProgressStatus>('loading');

  const [nearest, setNearest] = useState<NearestDestination | null>(null);
  const [nearestStatus, setNearestStatus] = useState<NearestStatus>('loading');

  const [latestAlert, setLatestAlert] = useState<LatestAlert | null>(null);
  const [alertStatus, setAlertStatus] = useState<AlertStatus>('loading');

  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const tripQuery = currentTripId !== null ? `?tripId=${currentTripId}` : '';

  /**
   * One pass over every card on the dashboard.
   *
   * These used to be five independent effects, two of which each called
   * `resolveCoordinates()` — so opening Home asked for location permission
   * twice and took two GPS fixes. Device position is now resolved once and
   * shared by the weather and "up next" cards.
   */
  const loadDashboard = useCallback(
    async (isCancelled: () => boolean) => {
      setWeatherStatus('loading');
      setChecklistStatus('loading');
      setInventoryStatus('loading');
      setNearestStatus('loading');
      setAlertStatus('loading');

      const device = await resolveCoordinates();
      if (isCancelled()) return;

      // A trip with its own coordinates describes the destination's weather;
      // otherwise fall back to wherever the device actually is.
      const hasTripCoords =
        currentTrip?.latitude != null && currentTrip?.longitude != null;
      const weatherLat = hasTripCoords ? currentTrip!.latitude! : device.latitude;
      const weatherLon = hasTripCoords ? currentTrip!.longitude! : device.longitude;
      setUsedDefaultLocation(hasTripCoords ? false : device.usedDefault);

      async function loadWeather() {
        try {
          const data = await apiRequest<Weather>('/weather', {
            query: { lat: weatherLat, lon: weatherLon },
          });
          if (!isCancelled()) {
            setWeather(data);
            setWeatherStatus('ready');
          }
        } catch (error) {
          if (!isCancelled()) {
            setWeatherError(describeError(error));
            setWeatherStatus('unavailable');
          }
        }
      }

      async function loadChecklist() {
        try {
          const data = await apiRequest<ChecklistItem[]>(
            `/checklist-items${tripQuery}`
          );
          if (!isCancelled()) setChecklistItems(data);
        } catch {
          if (!isCancelled()) setChecklistItems([]);
        } finally {
          if (!isCancelled()) setChecklistStatus('ready');
        }
      }

      async function loadInventory() {
        try {
          const data = await apiRequest<InventoryItem[]>(
            `/inventory-items${tripQuery}`
          );
          if (!isCancelled()) setInventoryItems(data);
        } catch {
          if (!isCancelled()) setInventoryItems([]);
        } finally {
          if (!isCancelled()) setInventoryStatus('ready');
        }
      }

      async function loadNearest() {
        try {
          const destinations = await apiRequest<SavedDestination[]>(
            `/saved-destinations${tripQuery}`
          );

          if (destinations.length === 0) {
            if (!isCancelled()) {
              setNearest(null);
              setNearestStatus('empty');
            }
            return;
          }

          const withDistances = await Promise.all(
            destinations.map(async (destination) => {
              const distance = await apiRequest<Distance>(
                `/saved-destinations/${destination.id}/distance`,
                {
                  query: { lat: device.latitude, lon: device.longitude },
                }
              );
              return { destination, distance };
            })
          );

          withDistances.sort((a, b) => a.distance.distanceKm - b.distance.distanceKm);

          if (!isCancelled()) {
            setNearest(withDistances[0]);
            setNearestStatus('ready');
          }
        } catch {
          if (!isCancelled()) {
            setNearest(null);
            setNearestStatus('error');
          }
        }
      }

      async function loadLatestAlert() {
        try {
          // Scoped like every other card — an unscoped fetch surfaced another
          // trip's alert while the rest of the dashboard showed this trip.
          const events = await apiRequest<GeofenceEvent[]>('/geofence-events', {
            query: { limit: 1, tripId: currentTripId },
          });

          if (events.length === 0) {
            if (!isCancelled()) {
              setLatestAlert(null);
              setAlertStatus('empty');
            }
            return;
          }

          const [event] = events;
          let triggerLabel = 'Unknown location';
          try {
            const trigger = await apiRequest<GeofenceTrigger>(
              `/geofence-triggers/${event.triggerId}`
            );
            triggerLabel = trigger.label;
          } catch {
            // Keep the fallback label if the trigger lookup fails.
          }

          if (!isCancelled()) {
            setLatestAlert({ event, triggerLabel });
            setAlertStatus('ready');
          }
        } catch {
          if (!isCancelled()) {
            setLatestAlert(null);
            setAlertStatus('error');
          }
        }
      }

      await Promise.all([
        loadWeather(),
        loadChecklist(),
        loadInventory(),
        loadNearest(),
        loadLatestAlert(),
      ]);
    },
    [currentTripId, currentTrip?.latitude, currentTrip?.longitude, tripQuery]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadDashboard(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [loadDashboard])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboard(() => false);
    setRefreshing(false);
  }

  const checkedCount = checklistItems.filter((item) => item.isChecked).length;
  const packedCount = inventoryItems.filter((item) => item.isPacked).length;

  // The "did you pack everything?" nudge: only meaningful for a specific trip
  // with something still to pack.
  const unpackedItems = inventoryItems.filter((item) => !item.isPacked);
  const showReadiness = currentTripId !== null && inventoryItems.length > 0;

  return (
    <ScreenContainer
      title="StepOut"
      onRefresh={handleRefresh}
      refreshing={refreshing}
      testID="home-scroll"
      headerRight={
        <Pressable
          style={styles.settingsButton}
          onPress={() => setSettingsVisible(true)}
          testID="home-settings-button"
          hitSlop={8}
        >
          <Text style={styles.settingsGlyph}>⚙️</Text>
        </Pressable>
      }
    >
      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onReset={() => {
          refreshTrips();
          handleRefresh();
        }}
      />

      <TripSwitcher />

      <View style={styles.weatherCard}>
        {weatherStatus === 'loading' && <ActivityIndicator />}
        {weatherStatus === 'ready' && weather && (
          <>
            <Text style={styles.weatherPlace}>
              {currentTrip?.name ?? 'Your location'}
            </Text>
            <View style={styles.weatherRow}>
              <Text style={styles.weatherTemp} testID="home-weather-summary">
                {Math.round(weather.temperatureCelsius)}°
              </Text>
              <View style={styles.weatherMeta}>
                {weather.highCelsius != null && weather.lowCelsius != null && (
                  <Text style={styles.weatherMetaText} testID="home-weather-range">
                    H:{Math.round(weather.highCelsius)}° L:
                    {Math.round(weather.lowCelsius)}°
                  </Text>
                )}
                <Text style={styles.weatherMetaText}>
                  {Math.round(weather.windSpeedKmh)} km/h wind
                </Text>
              </View>
            </View>
            <Text style={styles.weatherCondition}>
              {CONDITION_COPY[weather.condition] ?? weather.condition}
            </Text>
            {usedDefaultLocation && (
              <Text style={styles.note}>Using default location</Text>
            )}
          </>
        )}
        {weatherStatus === 'unavailable' && (
          <Text style={styles.weatherError} testID="home-weather-unavailable">
            {weatherError ?? 'Weather unavailable'}
          </Text>
        )}
      </View>

      <View style={styles.ringsRow}>
        {checklistStatus === 'loading' || inventoryStatus === 'loading' ? (
          <View style={styles.ringCard}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <View style={styles.ringCard}>
              <ProgressRing
                label="Checklist"
                completed={checkedCount}
                total={checklistItems.length}
                testID="home-checklist-ring"
              />
            </View>
            <View style={styles.ringCard}>
              <ProgressRing
                label="Packing"
                completed={packedCount}
                total={inventoryItems.length}
                testID="home-packing-ring"
              />
            </View>
          </>
        )}
      </View>

      {showReadiness && (
        <>
          <Text style={styles.sectionLabel}>READY TO GO?</Text>
          <View style={styles.rowCard} testID="home-readiness">
            {unpackedItems.length === 0 ? (
              <Text style={styles.readinessDone} testID="home-readiness-done">
                ✅ All packed — you're good to go.
              </Text>
            ) : (
              <>
                <Text style={styles.readinessTitle} testID="home-readiness-summary">
                  {packedCount} of {inventoryItems.length} packed — still need:
                </Text>
                <Text style={styles.readinessItems} testID="home-readiness-items">
                  {unpackedItems.map((item) => item.name).join(', ')}
                </Text>
              </>
            )}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>UP NEXT</Text>
      <View style={styles.rowCard}>
        {nearestStatus === 'loading' && <ActivityIndicator />}
        {nearestStatus === 'empty' && (
          <Text style={styles.rowMuted} testID="home-up-next-empty">
            No saved destinations yet
          </Text>
        )}
        {nearestStatus === 'error' && (
          <Text style={styles.rowMuted} testID="home-up-next-error">
            Could not load destinations
          </Text>
        )}
        {nearestStatus === 'ready' && nearest && (
          <View style={styles.rowContent}>
            <Text style={styles.rowIcon}>📍</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} testID="home-up-next-summary">
                {nearest.destination.label}
              </Text>
              <Text style={styles.rowSubtitle}>
                {nearest.distance.distanceKm} km away
              </Text>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>LATEST ALERT</Text>
      <View style={styles.rowCard}>
        {alertStatus === 'loading' && <ActivityIndicator />}
        {alertStatus === 'error' && (
          <Text style={styles.rowMuted} testID="home-latest-alert-error">
            Could not load alerts
          </Text>
        )}
        {alertStatus === 'empty' && (
          <Text style={styles.rowMuted} testID="home-latest-alert-empty">
            No alerts yet
          </Text>
        )}
        {alertStatus === 'ready' && latestAlert && (
          <View style={styles.rowContent}>
            <Text style={styles.rowIcon}>🔔</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} testID="home-latest-alert-summary">
                {latestAlert.event.direction === 'enter' ? 'Entered' : 'Left'}{' '}
                {latestAlert.triggerLabel}
              </Text>
              <Text style={styles.rowSubtitle}>
                {formatRelativeTime(latestAlert.event.firedAt)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  settingsGlyph: {
    fontSize: 16,
  },
  // Translucent so the coral-to-purple gradient reads through, per the mockup;
  // the previous opaque white cards flattened the whole screen.
  weatherCard: {
    backgroundColor: colors.cardTranslucent,
    borderWidth: 1,
    borderColor: colors.cardTranslucentBorder,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  weatherPlace: {
    color: colors.textOnGradientMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  weatherTemp: {
    color: colors.textOnGradient,
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 62,
  },
  weatherMeta: {
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
  },
  weatherMetaText: {
    color: colors.textOnGradientMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  weatherCondition: {
    color: colors.textOnGradient,
    fontSize: 15,
    fontWeight: '600',
  },
  weatherError: {
    color: colors.textOnGradient,
    fontSize: 14,
  },
  note: {
    fontSize: 12,
    color: colors.textOnGradientMuted,
    marginTop: 4,
  },
  ringsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  ringCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...cardShadow,
  },
  // Caps label sitting on the gradient above its card, not a title inside it.
  sectionLabel: {
    color: colors.sectionLabel,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  rowCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...cardShadow,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowMuted: {
    color: colors.textSecondary,
  },
  readinessTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  readinessItems: {
    color: colors.accent,
    fontWeight: '600',
  },
  readinessDone: {
    color: colors.accentDark,
    fontWeight: '700',
  },
});

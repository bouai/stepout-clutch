import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import GlassCard from '../components/GlassCard';
import GuidanceCard from '../components/GuidanceCard';
import ProgressRing from '../components/ProgressRing';
import ScreenContainer from '../components/ScreenContainer';
import SettingsSheet from '../components/SettingsSheet';
import TripSwitcher from '../components/TripSwitcher';
import { SectionLabel } from '../components/ui';
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
import { colors, radius, spacing } from '../theme';
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

function weatherIcon(condition: string): string {
  switch (condition) {
    case 'rain':
      return '🌧';
    case 'snow':
      return '❄️';
    case 'extreme-heat':
      return '☀️';
    case 'extreme-cold':
      return '🥶';
    case 'wind':
      return '💨';
    default:
      return '⛅';
  }
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

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
      return { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE, usedDefault: true };
    }
    const position = await Location.getCurrentPositionAsync();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      usedDefault: false,
    };
  } catch {
    return { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE, usedDefault: true };
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

  const loadDashboard = useCallback(
    async (isCancelled: () => boolean) => {
      setWeatherStatus('loading');
      setChecklistStatus('loading');
      setInventoryStatus('loading');
      setNearestStatus('loading');
      setAlertStatus('loading');

      const device = await resolveCoordinates();
      if (isCancelled()) return;

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
          const data = await apiRequest<ChecklistItem[]>(`/checklist-items${tripQuery}`);
          if (!isCancelled()) setChecklistItems(data);
        } catch {
          if (!isCancelled()) setChecklistItems([]);
        } finally {
          if (!isCancelled()) setChecklistStatus('ready');
        }
      }

      async function loadInventory() {
        try {
          const data = await apiRequest<InventoryItem[]>(`/inventory-items${tripQuery}`);
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
                { query: { lat: device.latitude, lon: device.longitude } }
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
            // Keep the fallback label.
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
  const unpackedItems = inventoryItems.filter((item) => !item.isPacked);

  const totalItems = checklistItems.length + inventoryItems.length;
  const doneItems = checkedCount + packedCount;
  const readyPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const progressLoading = checklistStatus === 'loading' || inventoryStatus === 'loading';

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

      <Text style={styles.greeting}>
        {greeting()} {weather ? weatherIcon(weather.condition) : '👋'}
      </Text>

      <TripSwitcher />

      <GuidanceCard
        id="home"
        title="Your command center"
        body="Home shows your next trip, the weather where you're headed, and how ready you are — so you can see everything at a glance before you leave."
      />

      <GlassCard style={styles.weatherCard} tone="hero">
        {weatherStatus === 'loading' && <ActivityIndicator color={colors.accent} />}
        {weatherStatus === 'ready' && weather && (
          <>
            <Text style={styles.weatherPlace}>
              {currentTrip?.name ?? 'Your location'}
            </Text>
            <View style={styles.weatherRow}>
              <View style={styles.weatherTempWrap}>
                <Text style={styles.weatherTemp} testID="home-weather-summary">
                  {Math.round(weather.temperatureCelsius)}°
                </Text>
                <Text style={styles.weatherGlyph}>{weatherIcon(weather.condition)}</Text>
              </View>
              <View style={styles.weatherMeta}>
                {weather.highCelsius != null && weather.lowCelsius != null && (
                  <Text style={styles.weatherMetaText} testID="home-weather-range">
                    H:{Math.round(weather.highCelsius)}° L:{Math.round(weather.lowCelsius)}°
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
      </GlassCard>

      <GlassCard style={styles.readyCard} testID="home-ready" tone="hero">
        {progressLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : totalItems === 0 ? (
          <View style={styles.readyEmptyWrap}>
            <Text style={styles.readyEmptyTitle} testID="home-ready-empty">
              Nothing to prepare yet
            </Text>
            <Text style={styles.readyEmptyBody}>
              Create a trip and StepOut builds your checklist, packing list and alerts.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.readyTop}>
              <ProgressRing
                label=""
                completed={doneItems}
                total={totalItems}
                size={92}
                strokeWidth={9}
                centerLabel={`${readyPercent}%`}
                onGlass
                testID="home-ready-ring"
              />
              <View style={styles.readySubs}>
                <Text style={styles.readyHeadline} testID="home-ready-headline">
                  {readyPercent === 100 ? "You're all set 🎉" : 'Ready to go?'}
                </Text>
                <Text style={styles.readySubStat} testID="home-checklist-count">
                  ✓ Checklist {checkedCount}/{checklistItems.length}
                </Text>
                <Text style={styles.readySubStat} testID="home-packing-count">
                  🎒 Packing {packedCount}/{inventoryItems.length}
                </Text>
              </View>
            </View>
            {unpackedItems.length > 0 && (
              <View style={styles.stillNeed} testID="home-readiness">
                <Text style={styles.stillNeedLabel} testID="home-readiness-summary">
                  Still need ({unpackedItems.length}):
                </Text>
                <Text style={styles.stillNeedItems} testID="home-readiness-items">
                  {unpackedItems.map((item) => item.name).join(', ')}
                </Text>
              </View>
            )}
          </>
        )}
      </GlassCard>

      <SectionLabel>Up next</SectionLabel>
      <GlassCard style={styles.rowCard}>
        {nearestStatus === 'loading' && <ActivityIndicator color={colors.accent} />}
        {nearestStatus === 'empty' && (
          <Text style={styles.rowMuted} testID="home-up-next-empty">
            No saved places yet — add one on the Map tab to get arrival alerts.
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
              <Text style={styles.rowSubtitle}>{nearest.distance.distanceKm} km away</Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </View>
        )}
      </GlassCard>

      <SectionLabel>Latest alert</SectionLabel>
      <GlassCard style={styles.rowCard}>
        {alertStatus === 'loading' && <ActivityIndicator color={colors.accent} />}
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
            <Text style={styles.rowChevron}>›</Text>
          </View>
        )}
      </GlassCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chipIdleBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  settingsGlyph: {
    fontSize: 17,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  weatherCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  weatherPlace: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  weatherTempWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  weatherTemp: {
    color: colors.textPrimary,
    fontSize: 60,
    fontWeight: '800',
    lineHeight: 64,
    letterSpacing: -2,
  },
  weatherGlyph: {
    fontSize: 30,
    marginTop: 6,
  },
  weatherMeta: {
    alignItems: 'flex-end',
    paddingTop: spacing.md,
    gap: 2,
  },
  weatherMetaText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  weatherCondition: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  weatherError: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  note: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  readyCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  readyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  readySubs: {
    flex: 1,
    gap: 6,
  },
  readyHeadline: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  readySubStat: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  readyEmptyWrap: {
    gap: 6,
    paddingVertical: spacing.sm,
  },
  readyEmptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  readyEmptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  stillNeed: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
    paddingTop: spacing.md,
    gap: 4,
  },
  stillNeedLabel: {
    color: colors.warn,
    fontWeight: '700',
    fontSize: 14,
  },
  stillNeedItems: {
    color: colors.warn,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  rowCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
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
  rowChevron: {
    fontSize: 24,
    color: colors.textTertiary,
    fontWeight: '400',
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
    lineHeight: 20,
  },
});

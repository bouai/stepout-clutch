import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import TripSwitcher from '../components/TripSwitcher';
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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
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

function ProgressRing({
  label,
  completed,
  total,
  testID,
}: {
  label: string;
  completed: number;
  total: number;
  testID: string;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <View style={styles.ringWrapper} testID={testID}>
      <View style={styles.ring}>
        <Text style={styles.ringPercent}>{percent}%</Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
      <Text style={styles.ringFraction}>
        {completed}/{total}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { trips, currentTripId } = useTripContext();
  const currentTrip = trips.find((trip) => trip.id === currentTripId) ?? null;

  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('loading');
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
          const response = await fetch(
            `${API_URL}/weather?lat=${weatherLat}&lon=${weatherLon}`
          );
          if (!response.ok) throw new Error('weather request failed');
          const data: Weather = await response.json();
          if (!isCancelled()) {
            setWeather(data);
            setWeatherStatus('ready');
          }
        } catch {
          if (!isCancelled()) setWeatherStatus('unavailable');
        }
      }

      async function loadChecklist() {
        try {
          const response = await fetch(`${API_URL}/checklist-items${tripQuery}`);
          if (!response.ok) throw new Error('checklist request failed');
          const data: ChecklistItem[] = await response.json();
          if (!isCancelled()) setChecklistItems(data);
        } catch {
          if (!isCancelled()) setChecklistItems([]);
        } finally {
          if (!isCancelled()) setChecklistStatus('ready');
        }
      }

      async function loadInventory() {
        try {
          const response = await fetch(`${API_URL}/inventory-items${tripQuery}`);
          if (!response.ok) throw new Error('inventory request failed');
          const data: InventoryItem[] = await response.json();
          if (!isCancelled()) setInventoryItems(data);
        } catch {
          if (!isCancelled()) setInventoryItems([]);
        } finally {
          if (!isCancelled()) setInventoryStatus('ready');
        }
      }

      async function loadNearest() {
        try {
          const response = await fetch(`${API_URL}/saved-destinations${tripQuery}`);
          if (!response.ok) throw new Error('saved-destinations request failed');
          const destinations: SavedDestination[] = await response.json();

          if (destinations.length === 0) {
            if (!isCancelled()) {
              setNearest(null);
              setNearestStatus('empty');
            }
            return;
          }

          const withDistances = await Promise.all(
            destinations.map(async (destination) => {
              const distanceResponse = await fetch(
                `${API_URL}/saved-destinations/${destination.id}/distance?lat=${device.latitude}&lon=${device.longitude}`
              );
              if (!distanceResponse.ok) {
                throw new Error('distance request failed');
              }
              const distance: Distance = await distanceResponse.json();
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
          const response = await fetch(
            `${API_URL}/geofence-events?limit=1${
              currentTripId !== null ? `&tripId=${currentTripId}` : ''
            }`
          );
          if (!response.ok) throw new Error('geofence-events request failed');
          const events: GeofenceEvent[] = await response.json();

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
            const triggerResponse = await fetch(
              `${API_URL}/geofence-triggers/${event.triggerId}`
            );
            if (triggerResponse.ok) {
              const trigger: GeofenceTrigger = await triggerResponse.json();
              triggerLabel = trigger.label;
            }
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

  return (
    <ScreenContainer
      title="Home"
      onRefresh={handleRefresh}
      refreshing={refreshing}
      testID="home-scroll"
    >
      <TripSwitcher />

      <View style={styles.card}>
        {weatherStatus === 'loading' && <ActivityIndicator />}
        {weatherStatus === 'ready' && weather && (
          <>
            <Text testID="home-weather-summary">
              {Math.round(weather.temperatureCelsius)}°C · {weather.condition}
            </Text>
            {usedDefaultLocation && (
              <Text style={styles.note}>Using default location</Text>
            )}
          </>
        )}
        {weatherStatus === 'unavailable' && (
          <Text testID="home-weather-unavailable">Weather unavailable</Text>
        )}
      </View>

      <View style={[styles.card, styles.ringsCard]}>
        {checklistStatus === 'loading' || inventoryStatus === 'loading' ? (
          <ActivityIndicator />
        ) : (
          <>
            <ProgressRing
              label="Checklist"
              completed={checkedCount}
              total={checklistItems.length}
              testID="home-checklist-ring"
            />
            <ProgressRing
              label="Packing"
              completed={packedCount}
              total={inventoryItems.length}
              testID="home-packing-ring"
            />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Up Next</Text>
        {nearestStatus === 'loading' && <ActivityIndicator />}
        {nearestStatus === 'empty' && (
          <Text testID="home-up-next-empty">No saved destinations yet</Text>
        )}
        {nearestStatus === 'error' && (
          <Text testID="home-up-next-error">Could not load destinations</Text>
        )}
        {nearestStatus === 'ready' && nearest && (
          <Text testID="home-up-next-summary">
            {nearest.destination.label} · {nearest.distance.distanceKm} km
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Latest Alert</Text>
        {alertStatus === 'loading' && <ActivityIndicator />}
        {alertStatus === 'error' && (
          <Text testID="home-latest-alert-error">Could not load alerts</Text>
        )}
        {alertStatus === 'empty' && (
          <Text testID="home-latest-alert-empty">No alerts yet</Text>
        )}
        {alertStatus === 'ready' && latestAlert && (
          <Text testID="home-latest-alert-summary">
            {latestAlert.triggerLabel} · {latestAlert.event.direction} ·{' '}
            {formatRelativeTime(latestAlert.event.firedAt)}
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  note: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  ringsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ringWrapper: {
    alignItems: 'center',
  },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ringPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ringLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ringFraction: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});

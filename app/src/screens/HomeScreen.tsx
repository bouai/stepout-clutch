import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
import { cardShadow, colors, radius, spacing, typography } from '../theme';

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

function formatRelativeTime(isoTimestamp: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000)
  );

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadWeather() {
        setWeatherStatus('loading');

        let latitude: number;
        let longitude: number;
        let usedDefault: boolean;

        if (currentTrip?.latitude != null && currentTrip?.longitude != null) {
          latitude = currentTrip.latitude;
          longitude = currentTrip.longitude;
          usedDefault = false;
        } else {
          const resolved = await resolveCoordinates();
          latitude = resolved.latitude;
          longitude = resolved.longitude;
          usedDefault = resolved.usedDefault;
        }

        if (cancelled) return;
        setUsedDefaultLocation(usedDefault);

        try {
          const response = await fetch(
            `${API_URL}/weather?lat=${latitude}&lon=${longitude}`
          );
          if (!response.ok) throw new Error('weather request failed');
          const data: Weather = await response.json();
          if (!cancelled) {
            setWeather(data);
            setWeatherStatus('ready');
          }
        } catch {
          if (!cancelled) {
            setWeatherStatus('unavailable');
          }
        }
      }

      loadWeather();

      return () => {
        cancelled = true;
      };
    }, [currentTrip?.latitude, currentTrip?.longitude])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadChecklist() {
        setChecklistStatus('loading');
        try {
          const url =
            currentTripId !== null
              ? `${API_URL}/checklist-items?tripId=${currentTripId}`
              : `${API_URL}/checklist-items`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('checklist request failed');
          const data: ChecklistItem[] = await response.json();
          if (!cancelled) {
            setChecklistItems(data);
          }
        } catch {
          if (!cancelled) {
            setChecklistItems([]);
          }
        } finally {
          if (!cancelled) {
            setChecklistStatus('ready');
          }
        }
      }

      loadChecklist();

      return () => {
        cancelled = true;
      };
    }, [currentTripId])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadInventory() {
        setInventoryStatus('loading');
        try {
          const url =
            currentTripId !== null
              ? `${API_URL}/inventory-items?tripId=${currentTripId}`
              : `${API_URL}/inventory-items`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('inventory request failed');
          const data: InventoryItem[] = await response.json();
          if (!cancelled) {
            setInventoryItems(data);
          }
        } catch {
          if (!cancelled) {
            setInventoryItems([]);
          }
        } finally {
          if (!cancelled) {
            setInventoryStatus('ready');
          }
        }
      }

      loadInventory();

      return () => {
        cancelled = true;
      };
    }, [currentTripId])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadNearest() {
        setNearestStatus('loading');

        const { latitude, longitude } = await resolveCoordinates();
        if (cancelled) return;

        try {
          const url =
            currentTripId !== null
              ? `${API_URL}/saved-destinations?tripId=${currentTripId}`
              : `${API_URL}/saved-destinations`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('saved-destinations request failed');
          const destinations: SavedDestination[] = await response.json();

          if (destinations.length === 0) {
            if (!cancelled) {
              setNearest(null);
              setNearestStatus('empty');
            }
            return;
          }

          const withDistances = await Promise.all(
            destinations.map(async (destination) => {
              const distanceResponse = await fetch(
                `${API_URL}/saved-destinations/${destination.id}/distance?lat=${latitude}&lon=${longitude}`
              );
              if (!distanceResponse.ok) {
                throw new Error('distance request failed');
              }
              const distance: Distance = await distanceResponse.json();
              return { destination, distance };
            })
          );

          withDistances.sort((a, b) => a.distance.distanceKm - b.distance.distanceKm);

          if (!cancelled) {
            setNearest(withDistances[0]);
            setNearestStatus('ready');
          }
        } catch {
          if (!cancelled) {
            setNearest(null);
            setNearestStatus('error');
          }
        }
      }

      loadNearest();

      return () => {
        cancelled = true;
      };
    }, [currentTripId])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadLatestAlert() {
        setAlertStatus('loading');

        try {
          const response = await fetch(`${API_URL}/geofence-events?limit=1`);
          if (!response.ok) throw new Error('geofence-events request failed');
          const events: GeofenceEvent[] = await response.json();

          if (events.length === 0) {
            if (!cancelled) {
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

          if (!cancelled) {
            setLatestAlert({ event, triggerLabel });
            setAlertStatus('ready');
          }
        } catch {
          if (!cancelled) {
            setLatestAlert(null);
            setAlertStatus('error');
          }
        }
      }

      loadLatestAlert();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const checkedCount = checklistItems.filter((item) => item.isChecked).length;
  const packedCount = inventoryItems.filter((item) => item.isPacked).length;

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      <Text style={styles.title}>Home</Text>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  title: {
    ...typography.heading,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  note: {
    fontSize: 12,
    color: '#666',
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

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { ChecklistItem, Weather } from '../types/models';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;

type WeatherStatus = 'loading' | 'ready' | 'unavailable';

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

export default function PlannerScreen() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('loading');
  const [usedDefaultLocation, setUsedDefaultLocation] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      const { latitude, longitude, usedDefault } = await resolveCoordinates();
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChecklist() {
      try {
        const response = await fetch(`${API_URL}/checklist-items`);
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
          setChecklistLoading(false);
        }
      }
    }

    loadChecklist();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planner</Text>

      <View style={styles.weatherSection}>
        {weatherStatus === 'loading' && <ActivityIndicator />}
        {weatherStatus === 'ready' && weather && (
          <>
            <Text testID="weather-summary">
              {Math.round(weather.temperatureCelsius)}°C · {weather.condition}
            </Text>
            {usedDefaultLocation && (
              <Text style={styles.note}>Using default location</Text>
            )}
          </>
        )}
        {weatherStatus === 'unavailable' && (
          <Text testID="weather-unavailable">Weather unavailable</Text>
        )}
      </View>

      <View style={styles.checklistSection}>
        {checklistLoading && <ActivityIndicator />}
        {!checklistLoading &&
          checklistItems.map((item) => (
            <View key={item.id} style={styles.checklistRow}>
              <Text>{item.label}</Text>
              {weatherStatus === 'ready' &&
                weather &&
                item.weatherCondition === weather.condition && (
                  <Text style={styles.todayTag}>Today</Text>
                )}
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  weatherSection: {
    marginBottom: 24,
  },
  note: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  checklistSection: {
    gap: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  todayTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a7d34',
  },
});

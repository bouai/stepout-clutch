import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { Distance, SavedDestination } from '../types/models';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;
const DELTA = 0.05;

type ListStatus = 'loading' | 'ready' | 'error';
type DistanceStatus = 'idle' | 'loading' | 'ready' | 'error';

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

export default function TransitScreen() {
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [usedDefaultLocation, setUsedDefaultLocation] = useState(false);

  const [destinations, setDestinations] = useState<SavedDestination[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>('loading');

  const [selected, setSelected] = useState<SavedDestination | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus>('idle');

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      const { latitude, longitude, usedDefault } = await resolveCoordinates();
      if (!cancelled) {
        setCurrentLocation({ latitude, longitude });
        setUsedDefaultLocation(usedDefault);
      }
    }

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDestinations() {
      try {
        const response = await fetch(`${API_URL}/saved-destinations`);
        if (!response.ok) throw new Error('saved-destinations request failed');
        const data: SavedDestination[] = await response.json();
        if (!cancelled) {
          setDestinations(data);
          setListStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setListStatus('error');
        }
      }
    }

    loadDestinations();

    return () => {
      cancelled = true;
    };
  }, []);

  async function selectDestination(destination: SavedDestination) {
    setSelected(destination);
    setDistance(null);
    setDistanceStatus('loading');

    if (!currentLocation) {
      setDistanceStatus('error');
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/saved-destinations/${destination.id}/distance?lat=${currentLocation.latitude}&lon=${currentLocation.longitude}`
      );
      if (!response.ok) throw new Error('distance request failed');
      const data: Distance = await response.json();
      setDistance(data);
      setDistanceStatus('ready');
    } catch {
      setDistanceStatus('error');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapSection}>
        {currentLocation ? (
          <MapView
            style={styles.map}
            region={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: DELTA,
              longitudeDelta: DELTA,
            }}
          >
            <Marker
              coordinate={currentLocation}
              title="You"
              pinColor="blue"
              testID="current-location-marker"
            />
            {selected && (
              <Marker
                coordinate={{
                  latitude: selected.latitude,
                  longitude: selected.longitude,
                }}
                title={selected.label}
                testID="destination-marker"
              />
            )}
            {selected && (
              <Polyline
                coordinates={[currentLocation, selected]}
                strokeWidth={2}
              />
            )}
          </MapView>
        ) : (
          <ActivityIndicator style={styles.map} />
        )}
        {usedDefaultLocation && (
          <Text style={styles.note}>Using default location</Text>
        )}
      </View>

      <View style={styles.listSection}>
        {listStatus === 'loading' && <ActivityIndicator />}
        {listStatus === 'error' && (
          <Text testID="destinations-error">Could not load saved destinations</Text>
        )}
        {listStatus === 'ready' && destinations.length === 0 && (
          <Text testID="destinations-empty">No saved destinations yet</Text>
        )}
        {listStatus === 'ready' && destinations.length > 0 && (
          <FlatList
            data={destinations}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.destinationRow}
                onPress={() => selectDestination(item)}
              >
                <Text
                  style={
                    selected?.id === item.id ? styles.destinationSelected : undefined
                  }
                >
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      {selected && (
        <View style={styles.distanceSection}>
          {distanceStatus === 'loading' && <ActivityIndicator />}
          {distanceStatus === 'ready' && distance && (
            <Text testID="distance-summary">
              {distance.distanceKm} km · {distance.bearingDegrees}°
            </Text>
          )}
          {distanceStatus === 'error' && (
            <Text testID="distance-error">Could not calculate distance</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  mapSection: {
    height: 280,
  },
  map: {
    flex: 1,
  },
  note: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  destinationRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  destinationSelected: {
    fontWeight: '700',
  },
  distanceSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

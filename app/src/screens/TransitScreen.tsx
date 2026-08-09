import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { LatLng, Marker, Polyline } from 'react-native-maps';

import type { Distance, SavedDestination } from '../types/models';
import { cardShadow, colors, radius, spacing } from '../theme';

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
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [selected, setSelected] = useState<SavedDestination | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus>('idle');

  const [pendingLocation, setPendingLocation] = useState<LatLng | null>(null);
  const [createLabel, setCreateLabel] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

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

  function closeCreateModal() {
    setPendingLocation(null);
    setCreateLabel('');
    setCreateError(null);
  }

  async function submitCreateDestination() {
    const trimmed = createLabel.trim();
    if (trimmed.length === 0 || !pendingLocation) return;

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const response = await fetch(`${API_URL}/saved-destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: trimmed,
          latitude: pendingLocation.latitude,
          longitude: pendingLocation.longitude,
        }),
      });
      if (!response.ok) throw new Error('create request failed');
      const created: SavedDestination = await response.json();
      setDestinations((prev) => [...prev, created]);
      closeCreateModal();
    } catch {
      setCreateError('Could not add destination');
    } finally {
      setCreateSubmitting(false);
    }
  }

  function confirmDelete(destination: SavedDestination) {
    Alert.alert(
      'Delete destination?',
      `Delete "${destination.label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performDelete(destination),
        },
      ]
    );
  }

  async function performDelete(destination: SavedDestination) {
    const index = destinations.findIndex((d) => d.id === destination.id);

    setRowErrors((prev) => {
      if (!(destination.id in prev)) return prev;
      const next = { ...prev };
      delete next[destination.id];
      return next;
    });
    setDestinations((prev) => prev.filter((d) => d.id !== destination.id));
    if (selected?.id === destination.id) {
      setSelected(null);
      setDistance(null);
      setDistanceStatus('idle');
    }

    try {
      const response = await fetch(
        `${API_URL}/saved-destinations/${destination.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('delete request failed');
    } catch {
      setDestinations((prev) => {
        const next = [...prev];
        next.splice(index, 0, destination);
        return next;
      });
      setRowErrors((prev) => ({
        ...prev,
        [destination.id]: 'Could not delete',
      }));
    }
  }

  const canSubmitCreate = createLabel.trim().length > 0 && !createSubmitting;

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      <View style={styles.mapCard}>
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
            onPress={(e) => {
              setPendingLocation(e.nativeEvent.coordinate);
              setCreateLabel('');
              setCreateError(null);
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
            {pendingLocation && (
              <Marker
                coordinate={pendingLocation}
                pinColor="orange"
                testID="pending-marker"
              />
            )}
          </MapView>
        ) : (
          <ActivityIndicator style={styles.map} />
        )}
        </View>
      </View>
      {usedDefaultLocation && (
        <Text style={styles.note}>Using default location</Text>
      )}

      <View style={[styles.card, styles.listCard]}>
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
                <View style={styles.destinationRow}>
                  <View style={styles.destinationRowMain}>
                    <Pressable
                      style={styles.destinationLabel}
                      onPress={() => selectDestination(item)}
                    >
                      <Text
                        style={
                          selected?.id === item.id
                            ? styles.destinationSelected
                            : undefined
                        }
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      testID={`delete-${item.id}`}
                      hitSlop={8}
                    >
                      <Text style={styles.deleteButton}>Delete</Text>
                    </Pressable>
                  </View>
                  {rowErrors[item.id] && (
                    <Text style={styles.rowError} testID={`row-error-${item.id}`}>
                      {rowErrors[item.id]}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </View>

      {selected && (
        <View style={[styles.card, styles.distanceSection]}>
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

      <Modal visible={pendingLocation !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Add Destination</Text>

            {pendingLocation && (
              <Text style={styles.modalCoords}>
                {pendingLocation.latitude.toFixed(5)},{' '}
                {pendingLocation.longitude.toFixed(5)}
              </Text>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Label"
              value={createLabel}
              onChangeText={setCreateLabel}
              testID="modal-label-input"
            />

            {createError && (
              <Text style={styles.rowError} testID="modal-error">
                {createError}
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={closeCreateModal} testID="modal-cancel-button">
                <Text style={styles.modalActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitCreateDestination}
                disabled={!canSubmitCreate}
                testID="modal-save-button"
              >
                <Text
                  style={[
                    styles.modalActionText,
                    !canSubmitCreate && styles.modalActionDisabled,
                  ]}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  mapCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...cardShadow,
  },
  listCard: {
    flex: 1,
  },
  mapSection: {
    height: 280,
  },
  map: {
    flex: 1,
  },
  note: {
    fontSize: 12,
    color: colors.textOnGradientMuted,
    paddingTop: 4,
    marginBottom: spacing.sm,
  },
  listSection: {
    flex: 1,
  },
  destinationRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  destinationRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  destinationLabel: {
    flex: 1,
  },
  destinationSelected: {
    fontWeight: '700',
  },
  deleteButton: {
    color: '#c0392b',
    fontWeight: '600',
  },
  rowError: {
    fontSize: 12,
    color: '#c0392b',
    marginTop: 4,
  },
  distanceSection: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalCoords: {
    fontSize: 12,
    color: '#666',
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
  },
  modalActionText: {
    fontWeight: '600',
    color: '#0a7d34',
  },
  modalActionDisabled: {
    color: '#aaa',
  },
});

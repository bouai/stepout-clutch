import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
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
import MapCanvas, {
  MapLine,
  MapPin,
  type Coordinate,
} from '../components/MapCanvas';

import ListState, { type LoadStatus } from '../components/ListState';
import ScreenContainer from '../components/ScreenContainer';
import TripSwitcher from '../components/TripSwitcher';
import { apiRequest, describeError } from '../api';
import { useTripContext } from '../context/TripContext';
import type { Distance, SavedDestination } from '../types/models';
import { cardShadow, colors, radius, spacing } from '../theme';

const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;

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
  const { currentTripId } = useTripContext();

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [usedDefaultLocation, setUsedDefaultLocation] = useState(false);

  const [destinations, setDestinations] = useState<SavedDestination[]>([]);
  const [listStatus, setListStatus] = useState<LoadStatus>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [selected, setSelected] = useState<SavedDestination | null>(null);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus>('idle');

  const [pendingLocation, setPendingLocation] = useState<Coordinate | null>(null);
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

  const loadDestinations = useCallback(
    async (isCancelled: () => boolean) => {
      try {
        const data = await apiRequest<SavedDestination[]>(
          '/saved-destinations',
          { query: { tripId: currentTripId } }
        );
        if (!isCancelled()) {
          setDestinations(data);
          setListError(null);
          setListStatus(data.length === 0 ? 'empty' : 'ready');
        }
      } catch (error) {
        if (!isCancelled()) {
          setListError(describeError(error));
          setListStatus('error');
        }
      }
    },
    [currentTripId]
  );

  function retryDestinations() {
    setListStatus('loading');
    loadDestinations(() => false);
  }

  useEffect(() => {
    let cancelled = false;
    loadDestinations(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadDestinations]);

  async function selectDestination(destination: SavedDestination) {
    setSelected(destination);
    setDistance(null);
    setDistanceStatus('loading');

    if (!currentLocation) {
      setDistanceStatus('error');
      return;
    }

    try {
      const data = await apiRequest<Distance>(
        `/saved-destinations/${destination.id}/distance`,
        {
          query: {
            lat: currentLocation.latitude,
            lon: currentLocation.longitude,
          },
        }
      );
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
      const created = await apiRequest<SavedDestination>('/saved-destinations', {
        method: 'POST',
        body: {
          label: trimmed,
          latitude: pendingLocation.latitude,
          longitude: pendingLocation.longitude,
          ...(currentTripId !== null ? { tripId: currentTripId } : {}),
        },
      });
      setDestinations((prev) => [...prev, created]);
      setListStatus('ready');
      closeCreateModal();
    } catch (error) {
      setCreateError(describeError(error));
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
      await apiRequest<void>(`/saved-destinations/${destination.id}`, {
        method: 'DELETE',
      });
      if (destinations.length === 1) setListStatus('empty');
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
    <ScreenContainer scrollable={false} testID="transit-fixed">
      <View style={styles.tripSwitcherWrapper}>
        <TripSwitcher />
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapSection}>
        {currentLocation ? (
          <MapCanvas
            center={currentLocation}
            testID="transit-map"
            onPress={(coordinate) => {
              setPendingLocation(coordinate);
              setCreateLabel('');
              setCreateError(null);
            }}
          >
            {selected && (
              <>
                <MapLine id="route" from={currentLocation} to={selected} />
                <MapPin
                  id="destination"
                  coordinate={selected}
                  testID="destination-marker"
                />
              </>
            )}
            {pendingLocation && (
              <MapPin
                id="pending"
                coordinate={pendingLocation}
                glyph="➕"
                tone="muted"
                testID="pending-marker"
              />
            )}
          </MapCanvas>
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
          <ListState
            status={listStatus}
            emptyMessage="No saved destinations yet"
            errorMessage={listError ?? undefined}
            onRetry={retryDestinations}
            testIDPrefix="destinations"
          />
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tripSwitcherWrapper: {
    marginBottom: spacing.sm,
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
    borderBottomColor: colors.cardBorder,
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
    color: colors.danger,
    fontWeight: '600',
  },
  rowError: {
    fontSize: 12,
    color: colors.danger,
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
    color: colors.textSecondary,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textSecondary,
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
    color: colors.accent,
  },
  modalActionDisabled: {
    color: colors.textSecondary,
  },
});

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Circle, LatLng, Marker } from 'react-native-maps';

import ListState, { type LoadStatus } from '../components/ListState';
import ScreenContainer from '../components/ScreenContainer';
import TripSwitcher from '../components/TripSwitcher';
import { apiRequest, describeError } from '../api';
import { useTripContext } from '../context/TripContext';
import type { GeofenceTrigger, GeofenceTriggerType } from '../types/models';
import { cardShadow, colors, radius, spacing } from '../theme';

const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;
const DELTA = 0.05;
const EARTH_RADIUS_METERS = 6371000;

type TrackingStatus = 'checking' | 'unavailable' | 'active';
type ProximityState = 'inside' | 'outside';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export default function ActiveTrackingScreen() {
  const { currentTripId } = useTripContext();

  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('checking');

  const [triggers, setTriggers] = useState<GeofenceTrigger[]>([]);
  const [listStatus, setListStatus] = useState<LoadStatus>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [pendingLocation, setPendingLocation] = useState<LatLng | null>(null);
  const [modalLabel, setModalLabel] = useState('');
  const [modalRadius, setModalRadius] = useState('');
  const [modalType, setModalType] = useState<GeofenceTriggerType>('enter');
  const [modalMessage, setModalMessage] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const baselineRef = useRef<Record<number, ProximityState>>({});
  const triggersRef = useRef<GeofenceTrigger[]>(triggers);

  useEffect(() => {
    triggersRef.current = triggers;
  }, [triggers]);

  const loadTriggers = useCallback(
    async (isCancelled: () => boolean) => {
      try {
        const data = await apiRequest<GeofenceTrigger[]>('/geofence-triggers', {
          query: { tripId: currentTripId },
        });
        if (!isCancelled()) {
          setTriggers(data);
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

  function retryTriggers() {
    setListStatus('loading');
    loadTriggers(() => false);
  }

  useEffect(() => {
    let cancelled = false;
    loadTriggers(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadTriggers]);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    function evaluateTriggers(location: LatLng) {
      for (const trigger of triggersRef.current) {
        if (!trigger.isActive) continue;

        const distanceMeters = haversineDistanceMeters(location, {
          latitude: trigger.latitude,
          longitude: trigger.longitude,
        });
        const state: ProximityState =
          distanceMeters <= trigger.radiusMeters ? 'inside' : 'outside';
        const priorState = baselineRef.current[trigger.id];

        if (priorState === undefined) {
          baselineRef.current[trigger.id] = state;
          continue;
        }

        if (priorState !== state) {
          baselineRef.current[trigger.id] = state;
          const transitionType: GeofenceTriggerType =
            state === 'inside' ? 'enter' : 'exit';
          if (transitionType === trigger.triggerType) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: trigger.label,
                body: trigger.notificationMessage,
              },
              trigger: null,
            });
            apiRequest('/geofence-events', {
              method: 'POST',
              body: {
                triggerId: trigger.id,
                direction: transitionType,
              },
            }).catch(() => {
              // Fire-and-forget: event logging failure must never affect the
              // notification or be surfaced to the user.
            });
          }
        }
      }
    }

    async function startTracking() {
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      const notificationPermission = await Notifications.requestPermissionsAsync();

      if (
        cancelled ||
        locationPermission.status !== 'granted' ||
        !notificationPermission.granted
      ) {
        if (!cancelled) setTrackingStatus('unavailable');
        return;
      }

      setTrackingStatus('active');

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (position) => {
          const location: LatLng = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCurrentLocation(location);
          evaluateTriggers(location);
        }
      );
    }

    startTracking();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  function closeCreateModal() {
    setPendingLocation(null);
    setModalLabel('');
    setModalRadius('');
    setModalType('enter');
    setModalMessage('');
    setModalError(null);
  }

  function clearRowError(triggerId: number) {
    setRowErrors((prev) => {
      if (!(triggerId in prev)) return prev;
      const next = { ...prev };
      delete next[triggerId];
      return next;
    });
  }

  async function toggleActive(trigger: GeofenceTrigger) {
    const previousActive = trigger.isActive;
    const nextActive = !previousActive;

    clearRowError(trigger.id);
    setTriggers((prev) =>
      prev.map((row) =>
        row.id === trigger.id ? { ...row, isActive: nextActive } : row
      )
    );

    try {
      await apiRequest<GeofenceTrigger>(`/geofence-triggers/${trigger.id}`, {
        method: 'PATCH',
        body: { isActive: nextActive },
      });
    } catch {
      setTriggers((prev) =>
        prev.map((row) =>
          row.id === trigger.id ? { ...row, isActive: previousActive } : row
        )
      );
      setRowErrors((prev) => ({ ...prev, [trigger.id]: 'Could not save change' }));
    }
  }

  function confirmDelete(trigger: GeofenceTrigger) {
    Alert.alert(
      'Delete trigger?',
      `Delete "${trigger.label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performDelete(trigger),
        },
      ]
    );
  }

  async function performDelete(trigger: GeofenceTrigger) {
    const index = triggers.findIndex((row) => row.id === trigger.id);

    clearRowError(trigger.id);
    setTriggers((prev) => prev.filter((row) => row.id !== trigger.id));

    try {
      await apiRequest<void>(`/geofence-triggers/${trigger.id}`, {
        method: 'DELETE',
      });
      if (triggers.length === 1) setListStatus('empty');
    } catch {
      setTriggers((prev) => {
        const next = [...prev];
        next.splice(index, 0, trigger);
        return next;
      });
      setRowErrors((prev) => ({ ...prev, [trigger.id]: 'Could not delete' }));
    }
  }

  const radiusNumber = parseFloat(modalRadius);
  const validRadius = Number.isFinite(radiusNumber) && radiusNumber > 0;
  const canSubmitModal =
    modalLabel.trim().length > 0 &&
    validRadius &&
    modalMessage.trim().length > 0 &&
    !modalSubmitting;

  async function submitCreateTrigger() {
    if (!canSubmitModal || !pendingLocation) return;

    setModalSubmitting(true);
    setModalError(null);

    try {
      const created = await apiRequest<GeofenceTrigger>('/geofence-triggers', {
        method: 'POST',
        body: {
          label: modalLabel.trim(),
          latitude: pendingLocation.latitude,
          longitude: pendingLocation.longitude,
          radiusMeters: radiusNumber,
          triggerType: modalType,
          notificationMessage: modalMessage.trim(),
          ...(currentTripId !== null ? { tripId: currentTripId } : {}),
        },
      });
      setTriggers((prev) => [...prev, created]);
      setListStatus('ready');
      closeCreateModal();
    } catch (error) {
      setModalError(describeError(error));
    } finally {
      setModalSubmitting(false);
    }
  }

  const mapCenter = currentLocation ?? {
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
  };

  return (
    <ScreenContainer scrollable={false} testID="tracking-fixed">
      <View style={styles.tripSwitcherWrapper}>
        <TripSwitcher />
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapSection}>
        <MapView
          style={styles.map}
          region={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            latitudeDelta: DELTA,
            longitudeDelta: DELTA,
          }}
          onPress={(e) => {
            setPendingLocation(e.nativeEvent.coordinate);
            setModalLabel('');
            setModalRadius('');
            setModalType('enter');
            setModalMessage('');
            setModalError(null);
          }}
        >
          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              title="You"
              pinColor="blue"
              testID="current-location-marker"
            />
          )}

          {triggers.map((trigger) => (
            <Circle
              key={trigger.id}
              center={{ latitude: trigger.latitude, longitude: trigger.longitude }}
              radius={trigger.radiusMeters}
              fillColor={
                trigger.isActive ? 'rgba(255,122,99,0.22)' : 'rgba(136,136,136,0.15)'
              }
              strokeColor={
                trigger.isActive ? 'rgba(255,122,99,0.85)' : 'rgba(136,136,136,0.6)'
              }
              strokeWidth={2}
            />
          ))}

          {pendingLocation && (
            <>
              <Marker
                coordinate={pendingLocation}
                pinColor="orange"
                testID="pending-marker"
              />
              {validRadius && (
                <Circle
                  center={pendingLocation}
                  radius={radiusNumber}
                  fillColor="rgba(230,126,34,0.2)"
                  strokeColor="rgba(230,126,34,0.8)"
                  strokeWidth={2}
                />
              )}
            </>
          )}
        </MapView>
        </View>
      </View>

      {trackingStatus === 'checking' && (
        <Text style={styles.note}>Checking tracking status…</Text>
      )}
      {trackingStatus === 'active' && (
        <Text style={styles.note} testID="tracking-status">
          Tracking: active
        </Text>
      )}
      {trackingStatus === 'unavailable' && (
        <Text style={styles.note} testID="tracking-status">
          Tracking unavailable
        </Text>
      )}

      <View style={[styles.card, styles.listCard]}>
        <ScrollView
          style={styles.listSection}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          testID="triggers-scroll"
        >
        <ListState
          status={listStatus}
          emptyMessage="No geofence triggers yet"
          errorMessage={listError ?? undefined}
          onRetry={retryTriggers}
          testIDPrefix="triggers"
        />
        {listStatus === 'ready' &&
          triggers.map((trigger) => (
            <View key={trigger.id} style={styles.triggerRow}>
              <View style={styles.triggerRowMain}>
                <Pressable
                  onPress={() => toggleActive(trigger)}
                  testID={`toggle-${trigger.id}`}
                  hitSlop={8}
                >
                  <Text style={styles.checkbox}>
                    {trigger.isActive ? '☑' : '☐'}
                  </Text>
                </Pressable>
                <Text
                  style={[
                    styles.triggerLabel,
                    !trigger.isActive && styles.triggerInactive,
                  ]}
                >
                  {trigger.label} · {trigger.triggerType} · {trigger.radiusMeters}m ·{' '}
                  {trigger.isActive ? 'active' : 'inactive'}
                </Text>
                <Pressable
                  onPress={() => confirmDelete(trigger)}
                  testID={`delete-${trigger.id}`}
                  hitSlop={8}
                >
                  <Text style={styles.deleteButton}>Delete</Text>
                </Pressable>
              </View>
              {rowErrors[trigger.id] && (
                <Text style={styles.rowError} testID={`row-error-${trigger.id}`}>
                  {rowErrors[trigger.id]}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      <Modal visible={pendingLocation !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Add Geofence Trigger</Text>

            {pendingLocation && (
              <Text style={styles.modalCoords}>
                {pendingLocation.latitude.toFixed(5)},{' '}
                {pendingLocation.longitude.toFixed(5)}
              </Text>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Label"
              value={modalLabel}
              onChangeText={setModalLabel}
              testID="modal-label-input"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Radius (meters)"
              value={modalRadius}
              onChangeText={setModalRadius}
              keyboardType="numeric"
              testID="modal-radius-input"
            />

            <View style={styles.typeToggle}>
              <Pressable
                style={[
                  styles.typeOption,
                  modalType === 'enter' && styles.typeOptionSelected,
                ]}
                onPress={() => setModalType('enter')}
                testID="modal-type-enter"
              >
                <Text>Enter</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeOption,
                  modalType === 'exit' && styles.typeOptionSelected,
                ]}
                onPress={() => setModalType('exit')}
                testID="modal-type-exit"
              >
                <Text>Exit</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Notification message"
              value={modalMessage}
              onChangeText={setModalMessage}
              testID="modal-message-input"
            />

            {modalError && (
              <Text style={styles.rowError} testID="modal-error">
                {modalError}
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={closeCreateModal} testID="modal-cancel-button">
                <Text style={styles.modalActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitCreateTrigger}
                disabled={!canSubmitModal}
                testID="modal-save-button"
              >
                <Text
                  style={[
                    styles.modalActionText,
                    !canSubmitModal && styles.modalActionDisabled,
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
  listContent: {
    paddingBottom: spacing.sm,
  },
  triggerRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  triggerRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    fontSize: 18,
  },
  triggerLabel: {
    flex: 1,
  },
  triggerInactive: {
    color: colors.textSecondary,
  },
  deleteButton: {
    color: colors.danger,
    fontWeight: '600',
  },
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
  typeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textSecondary,
    paddingVertical: 8,
    alignItems: 'center',
  },
  typeOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,122,99,0.12)',
  },
  rowError: {
    fontSize: 12,
    color: colors.danger,
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

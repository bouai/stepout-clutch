import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
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
import MapCanvas, {
  MapCircle,
  MapPin,
  type Coordinate,
} from '../components/MapCanvas';

import ListState, { type LoadStatus } from '../components/ListState';
import PlaceSearch, { type Place } from '../components/PlaceSearch';
import ScreenContainer from '../components/ScreenContainer';
import TripSwitcher from '../components/TripSwitcher';
import { apiRequest, describeError } from '../api';
import { startGeofencing } from '../geofencing';
import { useTripContext } from '../context/TripContext';
import type { GeofenceTrigger, GeofenceTriggerType } from '../types/models';
import { cardShadow, colors, radius, spacing } from '../theme';

const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;

type TrackingStatus = 'checking' | 'unavailable' | 'active';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function ActiveTrackingScreen() {
  const { currentTripId } = useTripContext();

  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('checking');
  const [trackingDetail, setTrackingDetail] = useState<string | null>(null);

  const [triggers, setTriggers] = useState<GeofenceTrigger[]>([]);
  const [listStatus, setListStatus] = useState<LoadStatus>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [pendingLocation, setPendingLocation] = useState<Coordinate | null>(null);
  const [modalLabel, setModalLabel] = useState('');
  const [modalRadius, setModalRadius] = useState('');
  const [modalType, setModalType] = useState<GeofenceTriggerType>('enter');
  const [modalMessage, setModalMessage] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

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

  // Keeps the map's "you are here" marker current. Purely cosmetic now —
  // trigger evaluation moved to the OS and no longer depends on this running.
  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    async function watchForMap() {
      const permission = await Location.getForegroundPermissionsAsync();
      if (cancelled || permission.status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      );
    }

    watchForMap();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [trackingStatus]);

  /**
   * Hands the current trigger set to the OS.
   *
   * This used to be a foreground `watchPositionAsync` loop doing haversine
   * checks in JS, which meant alerts fired only while this screen was open —
   * directly contradicting onboarding's promise of being alerted "the moment
   * you enter or leave a saved zone".
   */
  const syncGeofences = useCallback(async (active: GeofenceTrigger[]) => {
    const notificationPermission = await Notifications.requestPermissionsAsync();
    if (!notificationPermission.granted) {
      setTrackingStatus('unavailable');
      setTrackingDetail('Notifications are off, so alerts cannot be delivered.');
      return;
    }

    const result = await startGeofencing(active);

    if (result.ok) {
      setTrackingStatus('active');
      setTrackingDetail(
        `Watching ${result.regionCount} zone${result.regionCount === 1 ? '' : 's'} in the background.`
      );
      return;
    }

    setTrackingStatus('unavailable');
    setTrackingDetail(
      {
        'no-regions': 'No active zones to watch. Add one by tapping the map.',
        'no-foreground-permission': 'Location permission is off.',
        'no-background-permission':
          'Background location is off, so zones only fire while StepOut is open. Enable "Allow all the time" in settings.',
        failed: 'The system refused to register these zones.',
      }[result.reason]
    );
  }, []);

  useEffect(() => {
    if (listStatus !== 'ready' && listStatus !== 'empty') return;
    syncGeofences(triggers.filter((trigger) => trigger.isActive));
  }, [listStatus, triggers, syncGeofences]);

  /** Pre-fills the zone form from a search result, skipping the map tap. */
  function handlePlaceSelected(place: Place) {
    setPendingLocation({ latitude: place.latitude, longitude: place.longitude });
    setModalLabel(place.name);
    setModalRadius('200');
    setModalType('enter');
    setModalMessage(`Arrived at ${place.name}`);
    setModalError(null);
  }

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

      <View style={styles.searchWrapper}>
        <PlaceSearch
          placeholder="Search a place to watch"
          near={currentLocation}
          onSelect={handlePlaceSelected}
          testIDPrefix="tracking-place-search"
        />
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapSection}>
        <MapCanvas
          center={mapCenter}
          testID="tracking-map"
          onPress={(coordinate) => {
            setPendingLocation(coordinate);
            setModalLabel('');
            setModalRadius('');
            setModalType('enter');
            setModalMessage('');
            setModalError(null);
          }}
        >
          {triggers.map((trigger) => (
            <MapCircle
              key={trigger.id}
              id={String(trigger.id)}
              center={{ latitude: trigger.latitude, longitude: trigger.longitude }}
              radiusMeters={trigger.radiusMeters}
              active={trigger.isActive}
            />
          ))}

          {pendingLocation && (
            <>
              {validRadius && (
                <MapCircle
                  id="pending"
                  center={pendingLocation}
                  radiusMeters={radiusNumber}
                />
              )}
              <MapPin
                id="pending"
                coordinate={pendingLocation}
                glyph="➕"
                tone="muted"
                testID="pending-marker"
              />
            </>
          )}
        </MapCanvas>
        </View>
      </View>

      {trackingStatus === 'checking' && (
        <Text style={styles.note}>Checking tracking status…</Text>
      )}
      {trackingStatus !== 'checking' && (
        <Text style={styles.note} testID="tracking-status">
          {trackingStatus === 'active' ? 'Tracking: active' : 'Tracking unavailable'}
          {trackingDetail ? ` — ${trackingDetail}` : ''}
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
  searchWrapper: {
    marginBottom: spacing.sm,
    zIndex: 10,
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

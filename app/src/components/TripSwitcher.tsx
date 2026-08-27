import * as Location from 'expo-location';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTripContext, type TripCoords } from '../context/TripContext';
import type { TripType } from '../types/models';
import { colors, radius, spacing } from '../theme';
import { Button, Chip, TextField, Toggle } from './ui';
import Sheet from './Sheet';
import MapPicker from './MapPicker';
import PlaceSearch from './PlaceSearch';

type ModalMode = 'create' | 'rename';

/** Trip types offered in the create form, with the label the user sees. */
const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'commute', label: 'Commute' },
  { value: 'day-trip', label: 'Day trip' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'business', label: 'Business' },
  { value: 'flight', label: 'Flight' },
  { value: 'other', label: 'Other' },
];

interface TripSwitcherProps {
  /** Optional external control of the create sheet (used by onboarding). */
  createRequestId?: number;
}

export default function TripSwitcher({ createRequestId }: TripSwitcherProps) {
  const { trips, currentTripId, selectTrip, createTrip, renameTrip, deleteTrip } =
    useTripContext();

  const [mode, setMode] = useState<ModalMode | null>(null);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [coords, setCoords] = useState<TripCoords | null>(null);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName('');
    setCoords(null);
    setTripType(null);
    setIsRecurring(false);
    setLocating(false);
    setError(null);
  }

  function openCreateModal() {
    setMode('create');
    setEditingTripId(null);
    resetForm();
  }

  function openRenameModal(tripId: number, currentName: string) {
    const existing = trips.find((trip) => trip.id === tripId);
    setMode('rename');
    setEditingTripId(tripId);
    resetForm();
    setName(currentName);
    if (existing?.latitude != null && existing?.longitude != null) {
      setCoords({
        latitude: existing.latitude,
        longitude: existing.longitude,
        locationName: existing.locationName ?? undefined,
      });
    }
  }

  function closeModal() {
    setMode(null);
    setEditingTripId(null);
    resetForm();
  }

  async function captureLocation() {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location permission is off, so the trip has no coordinates.');
        return;
      }
      const position = await Location.getCurrentPositionAsync();
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setError('Could not read your location.');
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    setError(null);

    if (mode === 'rename' && editingTripId !== null) {
      const ok = await renameTrip(editingTripId, trimmed, coords ?? undefined);
      if (ok) closeModal();
      else setError('Could not rename trip');
      setSubmitting(false);
      return;
    }

    const result = await createTrip(trimmed, {
      coords: coords ?? undefined,
      tripType: tripType ?? undefined,
      isRecurring,
    });

    if (!result) {
      setError('Could not create trip');
      setSubmitting(false);
      return;
    }

    closeModal();
    setSubmitting(false);

    if (result.applied) {
      const { checklistAdded, inventoryAdded, zonesAdded, weatherCondition } =
        result.applied;
      const parts = [
        `${checklistAdded} checklist item${checklistAdded === 1 ? '' : 's'}`,
        `${inventoryAdded} packing item${inventoryAdded === 1 ? '' : 's'}`,
      ];
      if (zonesAdded > 0) parts.push('an arrival alert');
      const weatherNote =
        weatherCondition && weatherCondition !== 'clear'
          ? `\n\nAdded for ${weatherCondition} in the forecast.`
          : '';
      Alert.alert(`${trimmed} is ready`, `Set up ${parts.join(', ')}.${weatherNote}`);
    }
  }

  function openChipActions(tripId: number, tripName: string) {
    Alert.alert(tripName, undefined, [
      { text: 'Rename', onPress: () => openRenameModal(tripId, tripName) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(tripId, tripName),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDelete(tripId: number, tripName: string) {
    Alert.alert(
      'Delete trip?',
      `Delete "${tripName}"? Its items are kept and moved to All.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteTrip(tripId);
            if (!ok) Alert.alert('Could not delete trip');
          },
        },
      ]
    );
  }

  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Chip
          label="All"
          selected={currentTripId === null}
          onPress={() => selectTrip(null)}
          testID="trip-chip-all"
        />

        {trips.map((trip) => (
          <Chip
            key={trip.id}
            label={trip.isRecurring ? `🔁 ${trip.name}` : trip.name}
            selected={currentTripId === trip.id}
            onPress={() => selectTrip(trip.id)}
            onLongPress={() => openChipActions(trip.id, trip.name)}
            testID={`trip-chip-${trip.id}`}
          />
        ))}

        {trips.length === 0 ? (
          <Pressable
            style={styles.addChipProminent}
            onPress={openCreateModal}
            testID="trip-add-button"
          >
            <Text style={styles.addChipPromptText}>＋ New trip</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.addChip}
            onPress={openCreateModal}
            testID="trip-add-button"
          >
            <Text style={styles.addChipText}>+</Text>
          </Pressable>
        )}
      </ScrollView>

      <Sheet
        visible={mode !== null}
        onClose={closeModal}
        title={mode === 'rename' ? 'Rename trip' : 'New trip'}
        subtitle={
          mode === 'create'
            ? "Pick a type and we'll set up a starter list for you."
            : undefined
        }
        testID="trip-sheet"
        footer={
          <>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={closeModal}
              testID="trip-modal-cancel-button"
              style={styles.footerBtn}
            />
            <Button
              label={mode === 'rename' ? 'Save' : 'Create trip'}
              onPress={submit}
              disabled={!canSubmit}
              loading={submitting}
              testID="trip-modal-create-button"
              style={styles.footerBtn}
            />
          </>
        }
      >
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Trip name</Text>
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="e.g. Office"
            autoFocus
            testID="trip-name-input"
          />
        </View>

        {mode === 'create' && (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Trip type</Text>
              <View style={styles.typeGrid}>
                {TRIP_TYPES.map((type) => (
                  <Chip
                    key={type.value}
                    label={type.label}
                    selected={tripType === type.value}
                    onPress={() =>
                      setTripType(tripType === type.value ? null : type.value)
                    }
                    testID={`trip-type-${type.value}`}
                  />
                ))}
              </View>
            </View>

            <View style={styles.recurringRow}>
              <View style={styles.recurringText}>
                <Text style={styles.recurringLabel}>🔁 Repeats daily</Text>
                <Text style={styles.recurringHint}>
                  Resets the checklist each morning.
                </Text>
              </View>
              <Toggle
                value={isRecurring}
                onValueChange={setIsRecurring}
                testID="trip-recurring-toggle"
              />
            </View>
          </>
        )}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Location</Text>
          {coords ? (
            <View style={styles.locationChosen} testID="trip-location-chosen">
              <Text style={styles.locationText}>
                📍{' '}
                {coords.locationName ??
                  `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`}
              </Text>
              <Pressable onPress={() => setCoords(null)} testID="trip-clear-location">
                <Text style={styles.clearLocationText}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <PlaceSearch
                placeholder="Search a place for this trip"
                onSelect={(place) =>
                  setCoords({
                    latitude: place.latitude,
                    longitude: place.longitude,
                    locationName: place.context
                      ? `${place.name}, ${place.context}`
                      : place.name,
                  })
                }
                testIDPrefix="trip-place-search"
              />
              <View style={styles.locationOptions}>
                <Pressable
                  style={[styles.locationRow, styles.locationHalf]}
                  onPress={captureLocation}
                  disabled={locating}
                  testID="trip-use-location-button"
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={styles.locationText}>📍 Current</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.locationRow, styles.locationHalf]}
                  onPress={() => setPickerVisible(true)}
                  testID="trip-pick-map-button"
                >
                  <Text style={styles.locationText}>🗺 Pick on map</Text>
                </Pressable>
              </View>
            </>
          )}
          <Text style={styles.locationHint}>
            {tripType && mode === 'create'
              ? 'A location adds weather-based items and an arrival alert.'
              : "Weather on Home uses the trip's location when it has one."}
          </Text>
        </View>

        {error && (
          <Text style={styles.errorText} testID="trip-modal-error">
            {error}
          </Text>
        )}
      </Sheet>

      <MapPicker
        visible={pickerVisible}
        initialCenter={coords ?? null}
        onCancel={() => setPickerVisible(false)}
        onConfirm={(coordinate, locationName) => {
          setCoords({ ...coordinate, locationName });
          setPickerVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  row: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  addChip: {
    borderWidth: 1,
    borderColor: colors.chipIdleBorder,
    backgroundColor: colors.chipIdleBg,
    borderRadius: radius.pill,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChipText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  addChipProminent: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  addChipPromptText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  field: { gap: spacing.sm },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.sectionLabel,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.chipIdleBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  recurringText: { flex: 1, gap: 2 },
  recurringLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  recurringHint: { fontSize: 13, color: colors.textSecondary },
  locationOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  locationHalf: { flex: 1 },
  locationRow: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    backgroundColor: colors.chipIdleBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  locationChosen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.sm,
  },
  locationText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  clearLocationText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '700',
  },
  locationHint: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  footerBtn: { flex: 1 },
});

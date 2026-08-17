import * as Location from 'expo-location';
import { useState } from 'react';
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

import { useTripContext, type TripCoords } from '../context/TripContext';
import type { TripType } from '../types/models';
import { cardShadow, colors, radius, spacing } from '../theme';

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

export default function TripSwitcher() {
  const { trips, currentTripId, selectTrip, createTrip, renameTrip, deleteTrip } =
    useTripContext();

  const [mode, setMode] = useState<ModalMode | null>(null);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [coords, setCoords] = useState<TripCoords | null>(null);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [locating, setLocating] = useState(false);
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
      setCoords({ latitude: existing.latitude, longitude: existing.longitude });
    }
  }

  function closeModal() {
    setMode(null);
    setEditingTripId(null);
    resetForm();
  }

  /**
   * A trip without coordinates cannot drive Home's weather card — it silently
   * falls back to the device's location, which is wrong for a trip you have
   * not left for yet.
   */
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

    // Tell the user what the template did — this is the "it set itself up"
    // moment, and it also explains why their tabs are suddenly populated.
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
      Alert.alert(
        `${trimmed} is ready`,
        `Set up ${parts.join(', ')}.${weatherNote}`
      );
    }
  }

  // Long-press is the only affordance on a chip that small; a visible menu
  // would crowd the switcher, which the mockups keep to a single row.
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
        <Pressable
          style={[styles.chip, currentTripId === null && styles.chipSelected]}
          onPress={() => selectTrip(null)}
          testID="trip-chip-all"
        >
          <Text
            style={currentTripId === null ? styles.chipTextSelected : styles.chipText}
          >
            All
          </Text>
        </Pressable>

        {trips.map((trip) => (
          <Pressable
            key={trip.id}
            style={[styles.chip, currentTripId === trip.id && styles.chipSelected]}
            onPress={() => selectTrip(trip.id)}
            onLongPress={() => openChipActions(trip.id, trip.name)}
            testID={`trip-chip-${trip.id}`}
          >
            <Text
              style={
                currentTripId === trip.id ? styles.chipTextSelected : styles.chipText
              }
            >
              {trip.isRecurring ? `🔁 ${trip.name}` : trip.name}
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.addChip}
          onPress={openCreateModal}
          testID="trip-add-button"
        >
          <Text style={styles.addChipText}>+</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={mode !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>
              {mode === 'rename' ? 'Rename Trip' : 'New Trip'}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Trip name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoFocus
              testID="trip-name-input"
            />

            {mode === 'create' && (
              <>
                <Text style={styles.pickerLabel}>
                  Trip type — we'll set up a starter list
                </Text>
                <View style={styles.typeGrid}>
                  {TRIP_TYPES.map((type) => {
                    const selected = tripType === type.value;
                    return (
                      <Pressable
                        key={type.value}
                        style={[styles.typeChip, selected && styles.typeChipSelected]}
                        onPress={() => setTripType(selected ? null : type.value)}
                        testID={`trip-type-${type.value}`}
                      >
                        <Text
                          style={
                            selected ? styles.typeChipTextSelected : styles.typeChipText
                          }
                        >
                          {type.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.recurringRow}
                  onPress={() => setIsRecurring((prev) => !prev)}
                  testID="trip-recurring-toggle"
                >
                  <Text style={styles.recurringCheckbox}>
                    {isRecurring ? '☑' : '☐'}
                  </Text>
                  <Text style={styles.recurringLabel}>
                    🔁 Repeats daily — reset the checklist each morning
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              style={styles.locationRow}
              onPress={captureLocation}
              disabled={locating}
              testID="trip-use-location-button"
            >
              {locating ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={styles.locationText}>
                  {coords
                    ? `📍 ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`
                    : '📍 Use my current location'}
                </Text>
              )}
            </Pressable>

            {coords && (
              <Pressable onPress={() => setCoords(null)} testID="trip-clear-location">
                <Text style={styles.clearLocationText}>Clear location</Text>
              </Pressable>
            )}

            <Text style={styles.locationHint}>
              {tripType && mode === 'create'
                ? "A location adds weather-based items and an arrival alert."
                : "Weather on Home uses the trip's location when it has one."}
            </Text>

            {error && (
              <Text style={styles.errorText} testID="trip-modal-error">
                {error}
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} testID="trip-modal-cancel-button">
                <Text style={styles.modalActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                testID="trip-modal-create-button"
              >
                <Text
                  style={[
                    styles.modalActionText,
                    !canSubmit && styles.modalActionDisabled,
                  ]}
                >
                  {mode === 'rename' ? 'Save' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  chip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.card,
    borderColor: colors.card,
  },
  chipText: {
    color: colors.textOnGradient,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  addChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChipText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textOnGradient,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  typeChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  typeChipText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  typeChipTextSelected: {
    color: colors.textOnGradient,
    fontWeight: '700',
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recurringCheckbox: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  recurringLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  locationRow: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,122,99,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  locationText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  clearLocationText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  locationHint: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  modalActionText: {
    fontWeight: '700',
    color: colors.accent,
  },
  modalActionDisabled: {
    color: colors.textSecondary,
  },
});

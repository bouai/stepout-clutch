import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTripContext } from '../context/TripContext';
import { cardShadow, colors, radius, spacing } from '../theme';

type ModalMode = 'create' | 'rename';

export default function TripSwitcher() {
  const { trips, currentTripId, selectTrip, createTrip, renameTrip, deleteTrip } =
    useTripContext();

  const [mode, setMode] = useState<ModalMode | null>(null);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreateModal() {
    setMode('create');
    setEditingTripId(null);
    setName('');
    setError(null);
  }

  function openRenameModal(tripId: number, currentName: string) {
    setMode('rename');
    setEditingTripId(tripId);
    setName(currentName);
    setError(null);
  }

  function closeModal() {
    setMode(null);
    setEditingTripId(null);
    setName('');
    setError(null);
  }

  async function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    setError(null);

    const ok =
      mode === 'rename' && editingTripId !== null
        ? await renameTrip(editingTripId, trimmed)
        : (await createTrip(trimmed)) !== null;

    if (ok) {
      closeModal();
    } else {
      setError(mode === 'rename' ? 'Could not rename trip' : 'Could not create trip');
    }
    setSubmitting(false);
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
              {trip.name}
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

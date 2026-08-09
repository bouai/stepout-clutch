import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTripContext } from '../context/TripContext';

export default function TripSwitcher() {
  const { trips, currentTripId, selectTrip, createTrip } = useTripContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreateModal() {
    setName('');
    setError(null);
    setModalVisible(true);
  }

  function closeCreateModal() {
    setModalVisible(false);
    setName('');
    setError(null);
  }

  async function submitCreateTrip() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    setError(null);

    const created = await createTrip(trimmed);
    if (created) {
      closeCreateModal();
    } else {
      setError('Could not create trip');
    }
    setSubmitting(false);
  }

  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>New Trip</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Trip name"
              value={name}
              onChangeText={setName}
              testID="trip-name-input"
            />

            {error && (
              <Text style={styles.errorText} testID="trip-modal-error">
                {error}
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={closeCreateModal} testID="trip-modal-cancel-button">
                <Text style={styles.modalActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitCreateTrip}
                disabled={!canSubmit}
                testID="trip-modal-create-button"
              >
                <Text
                  style={[
                    styles.modalActionText,
                    !canSubmit && styles.modalActionDisabled,
                  ]}
                >
                  Create
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
    marginBottom: 16,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipSelected: {
    borderColor: '#0a7d34',
    backgroundColor: 'rgba(10,125,52,0.1)',
  },
  chipText: {
    color: '#333',
  },
  chipTextSelected: {
    color: '#0a7d34',
    fontWeight: '600',
  },
  addChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#c0392b',
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

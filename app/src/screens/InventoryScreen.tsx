import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ListState, { type LoadStatus } from '../components/ListState';
import ScreenContainer from '../components/ScreenContainer';
import SwipeRow from '../components/SwipeRow';
import TripSwitcher from '../components/TripSwitcher';
import { useTripContext } from '../context/TripContext';
import { useCachedResource, invalidateResource } from '../hooks/useCachedResource';
import { apiRequest, describeError } from '../api';
import type { InventoryCategory, InventoryItem } from '../types/models';
import { cardShadow, colors, radius, spacing, typography } from '../theme';

const INVENTORY_CATEGORIES: InventoryCategory[] = [
  'electronics',
  'documents',
  'weather-gear',
  'other',
];

async function patchInventoryItem(
  id: number,
  patch: Record<string, unknown>
): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/inventory-items/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

const inventoryPath = (tripId: number | null) =>
  tripId !== null ? `/inventory-items?tripId=${tripId}` : '/inventory-items';

export default function InventoryScreen() {
  const { currentTripId } = useTripContext();

  // Cached: the last-loaded list shows instantly on re-focus while a fresh copy
  // loads quietly behind it, so switching tabs no longer flashes empty.
  const {
    data,
    status: fetchStatus,
    error: loadError,
    refetch,
    mutate,
  } = useCachedResource<InventoryItem[]>(
    `inventory:${currentTripId ?? 'all'}`,
    inventoryPath(currentTripId)
  );
  const items = data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalCategory, setModalCategory] = useState<InventoryCategory | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const status: LoadStatus =
    fetchStatus === 'loading'
      ? 'loading'
      : fetchStatus === 'error'
        ? 'error'
        : items.length === 0
          ? 'empty'
          : 'ready';

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  // Keep the list fresh whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  function clearRowError(itemId: number) {
    setRowErrors((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  async function togglePacked(item: InventoryItem) {
    const previousPacked = item.isPacked;
    const nextPacked = !previousPacked;

    clearRowError(item.id);
    mutate((prev) =>
      (prev ?? []).map((row) =>
        row.id === item.id ? { ...row, isPacked: nextPacked } : row
      )
    );

    try {
      await patchInventoryItem(item.id, { isPacked: nextPacked });
      // A packing change flips any linked checklist item, so its cache is stale.
      invalidateResource('checklist:');
    } catch {
      mutate((prev) =>
        (prev ?? []).map((row) =>
          row.id === item.id ? { ...row, isPacked: previousPacked } : row
        )
      );
      setRowErrors((prev) => ({ ...prev, [item.id]: 'Could not save change' }));
    }
  }

  function confirmDelete(item: InventoryItem) {
    Alert.alert(
      'Delete item?',
      `Delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performDelete(item),
        },
      ]
    );
  }

  async function performDelete(item: InventoryItem) {
    const index = items.findIndex((row) => row.id === item.id);

    clearRowError(item.id);
    mutate((prev) => (prev ?? []).filter((row) => row.id !== item.id));

    try {
      await apiRequest<void>(`/inventory-items/${item.id}`, { method: 'DELETE' });
    } catch {
      mutate((prev) => {
        const next = [...(prev ?? [])];
        next.splice(index, 0, item);
        return next;
      });
      setRowErrors((prev) => ({ ...prev, [item.id]: 'Could not delete' }));
    }
  }

  function openAddModal() {
    setModalName('');
    setModalCategory(null);
    setModalError(null);
    setModalVisible(true);
  }

  function closeAddModal() {
    setModalVisible(false);
    setModalName('');
    setModalCategory(null);
    setModalError(null);
  }

  async function submitAddItem() {
    const trimmed = modalName.trim();
    if (trimmed.length === 0 || modalCategory === null) return;

    setModalSubmitting(true);
    setModalError(null);

    try {
      const created = await apiRequest<InventoryItem>('/inventory-items', {
        method: 'POST',
        body: {
          name: trimmed,
          category: modalCategory,
          ...(currentTripId !== null ? { tripId: currentTripId } : {}),
        },
      });
      mutate((prev) => [...(prev ?? []), created]);
      closeAddModal();
    } catch (error) {
      setModalError(describeError(error));
    } finally {
      setModalSubmitting(false);
    }
  }

  const canSubmitModal = modalName.trim().length > 0 && modalCategory !== null;

  return (
    <ScreenContainer
      onRefresh={handleRefresh}
      refreshing={refreshing}
      testID="inventory-scroll"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Pressable onPress={openAddModal} testID="add-item-button">
          <Text style={styles.addButton}>+ Add Item</Text>
        </Pressable>
      </View>

      <TripSwitcher />

      <View style={[styles.card, styles.listCard]}>
        <ListState
          status={status}
          emptyMessage="No inventory items yet"
          errorMessage={loadError ?? undefined}
          onRetry={refetch}
          testIDPrefix="inventory"
        />
        {status === 'ready' &&
          items.map((item) => (
            <View key={item.id} style={styles.row}>
              <SwipeRow
                onDelete={() => confirmDelete(item)}
                testID={`item-${item.id}`}
              >
                <View style={styles.rowMain}>
                  <Pressable
                    onPress={() => togglePacked(item)}
                    testID={`checkbox-${item.id}`}
                    hitSlop={8}
                  >
                    <Text style={styles.checkbox}>{item.isPacked ? '☑' : '☐'}</Text>
                  </Pressable>
                  <Text style={item.isPacked ? styles.nameChecked : styles.name}>
                    {item.name} ({item.quantity})
                  </Text>
                </View>
              </SwipeRow>
              {rowErrors[item.id] && (
                <Text style={styles.rowError} testID={`row-error-${item.id}`}>
                  {rowErrors[item.id]}
                </Text>
              )}
            </View>
          ))}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Add Item</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Name"
              value={modalName}
              onChangeText={setModalName}
              testID="modal-name-input"
            />

            <Picker
              selectedValue={modalCategory}
              onValueChange={(value) => setModalCategory(value)}
              testID="modal-category-picker"
            >
              <Picker.Item label="Select a category..." value={null} />
              {INVENTORY_CATEGORIES.map((category) => (
                <Picker.Item key={category} label={category} value={category} />
              ))}
            </Picker>

            {modalError && (
              <Text style={styles.rowError} testID="modal-error">
                {modalError}
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={closeAddModal} testID="modal-cancel-button">
                <Text style={styles.modalActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitAddItem}
                disabled={!canSubmitModal || modalSubmitting}
                testID="modal-add-button"
              >
                <Text
                  style={[
                    styles.modalActionText,
                    (!canSubmitModal || modalSubmitting) && styles.modalActionDisabled,
                  ]}
                >
                  Add
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  listCard: {},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    color: colors.accent,
    fontWeight: '600',
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    fontSize: 18,
  },
  name: {
    flex: 1,
  },
  nameChecked: {
    flex: 1,
    textDecorationLine: 'line-through',
    color: '#888',
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

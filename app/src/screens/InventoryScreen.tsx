import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { InventoryCategory, InventoryItem } from '../types/models';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

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
  const response = await fetch(`${API_URL}/inventory-items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error('patch request failed');
  return response.json();
}

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalCategory, setModalCategory] = useState<InventoryCategory | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      try {
        const response = await fetch(`${API_URL}/inventory-items`);
        if (!response.ok) throw new Error('inventory request failed');
        const data: InventoryItem[] = await response.json();
        if (!cancelled) {
          setItems(data);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadItems();

    return () => {
      cancelled = true;
    };
  }, []);

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
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, isPacked: nextPacked } : row))
    );

    try {
      await patchInventoryItem(item.id, { isPacked: nextPacked });
    } catch {
      setItems((prev) =>
        prev.map((row) =>
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
    setItems((prev) => prev.filter((row) => row.id !== item.id));

    try {
      const response = await fetch(`${API_URL}/inventory-items/${item.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('delete request failed');
    } catch {
      setItems((prev) => {
        const next = [...prev];
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
      const response = await fetch(`${API_URL}/inventory-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, category: modalCategory }),
      });
      if (!response.ok) throw new Error('create request failed');
      const created: InventoryItem = await response.json();
      setItems((prev) => [...prev, created]);
      closeAddModal();
    } catch {
      setModalError('Could not add item');
    } finally {
      setModalSubmitting(false);
    }
  }

  const canSubmitModal = modalName.trim().length > 0 && modalCategory !== null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Pressable onPress={openAddModal} testID="add-item-button">
          <Text style={styles.addButton}>+ Add Item</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator />}
      {!loading && items.length === 0 && (
        <Text testID="inventory-empty">No inventory items yet</Text>
      )}
      {!loading &&
        items.length > 0 &&
        items.map((item) => (
          <View key={item.id} style={styles.row}>
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
        ))}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    color: '#0a7d34',
    fontWeight: '600',
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
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
    color: '#c0392b',
    fontWeight: '600',
  },
  rowError: {
    fontSize: 12,
    color: '#c0392b',
    marginTop: 4,
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

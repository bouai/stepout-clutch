import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import GlassCard from '../components/GlassCard';
import GuidanceCard from '../components/GuidanceCard';
import ListState, { type LoadStatus } from '../components/ListState';
import ScreenContainer from '../components/ScreenContainer';
import Sheet from '../components/Sheet';
import SwipeRow from '../components/SwipeRow';
import TripSwitcher from '../components/TripSwitcher';
import { Button, Checkbox, Chip, SectionLabel, TextField } from '../components/ui';
import { useTripContext } from '../context/TripContext';
import { useCachedResource, invalidateResource } from '../hooks/useCachedResource';
import { apiRequest, describeError } from '../api';
import type { InventoryCategory, InventoryItem } from '../types/models';
import { colors, radius, spacing } from '../theme';

const INVENTORY_CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'documents', label: 'Documents' },
  { value: 'weather-gear', label: 'Weather gear' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_ICON: Record<InventoryCategory, string> = {
  electronics: '🔌',
  documents: '📄',
  'weather-gear': '🧥',
  other: '📦',
};

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
      (prev ?? []).map((row) => (row.id === item.id ? { ...row, isPacked: nextPacked } : row))
    );

    try {
      await patchInventoryItem(item.id, { isPacked: nextPacked });
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
    Alert.alert('Delete item?', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDelete(item) },
    ]);
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
  const packedCount = items.filter((i) => i.isPacked).length;

  return (
    <ScreenContainer
      title="Inventory"
      onRefresh={handleRefresh}
      refreshing={refreshing}
      testID="inventory-scroll"
    >
      <TripSwitcher />

      <GuidanceCard
        id="inventory"
        title="Your reusable essentials"
        body="These are the things you own. Trips reference them to build a packing list — so you set them up once and never think about them again."
      />

      <View style={styles.summaryRow}>
        <Text style={styles.summaryTitle}>Your essentials</Text>
        <Pressable style={styles.addPill} onPress={openAddModal} testID="add-item-button">
          <Text style={styles.addPillText}>＋ Add</Text>
        </Pressable>
      </View>

      <GlassCard style={styles.listCard} tone="hero">
        {status === 'ready' && (
          <Text style={styles.packedSummary}>
            {packedCount} of {items.length} packed
          </Text>
        )}
        {status !== 'ready' && (
          <ListState
            status={status}
            emptyMessage="Nothing here yet. Add your first item — a laptop, a charger, an umbrella — and trips can pack it for you."
            errorMessage={loadError ?? undefined}
            onRetry={refetch}
            testIDPrefix="inventory"
          />
        )}
        {status === 'empty' && (
          <View style={styles.emptyCta}>
            <Button label="Add your first item" icon="＋" onPress={openAddModal} />
          </View>
        )}
        {status === 'ready' &&
          items.map((item) => (
            <View key={item.id} style={styles.row}>
              <SwipeRow onDelete={() => confirmDelete(item)} testID={`item-${item.id}`}>
                <View style={styles.rowMain}>
                  <Checkbox
                    checked={item.isPacked}
                    onPress={() => togglePacked(item)}
                    testID={`checkbox-${item.id}`}
                  />
                  <Text style={styles.rowIcon}>{CATEGORY_ICON[item.category]}</Text>
                  <Text style={item.isPacked ? styles.nameChecked : styles.name}>
                    {item.name}
                  </Text>
                  {item.quantity > 1 && (
                    <Text style={styles.qty}>×{item.quantity}</Text>
                  )}
                </View>
              </SwipeRow>
              {rowErrors[item.id] && (
                <Text style={styles.rowError} testID={`row-error-${item.id}`}>
                  {rowErrors[item.id]}
                </Text>
              )}
            </View>
          ))}
      </GlassCard>

      <Sheet
        visible={modalVisible}
        onClose={closeAddModal}
        title="Add an item"
        testID="inventory-add-sheet"
        footer={
          <>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={closeAddModal}
              testID="modal-cancel-button"
              style={styles.footerBtn}
            />
            <Button
              label="Add item"
              onPress={submitAddItem}
              disabled={!canSubmitModal}
              loading={modalSubmitting}
              testID="modal-add-button"
              style={styles.footerBtn}
            />
          </>
        }
      >
        <View style={styles.fieldGroup}>
          <SectionLabel>Item name</SectionLabel>
          <TextField
            value={modalName}
            onChangeText={setModalName}
            placeholder="e.g. Laptop charger"
            autoFocus
            testID="modal-name-input"
          />
        </View>
        <View style={styles.fieldGroup}>
          <SectionLabel>Category</SectionLabel>
          <View style={styles.categoryGrid}>
            {INVENTORY_CATEGORIES.map((cat) => (
              <Chip
                key={cat.value}
                label={cat.label}
                selected={modalCategory === cat.value}
                onPress={() => setModalCategory(cat.value)}
                testID={`modal-category-${cat.value}`}
              />
            ))}
          </View>
        </View>
        {modalError && (
          <Text style={styles.rowError} testID="modal-error">
            {modalError}
          </Text>
        )}
      </Sheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  addPill: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  addPillText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  listCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  packedSummary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  emptyCta: {
    marginTop: spacing.md,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    fontSize: 18,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  nameChecked: {
    flex: 1,
    fontSize: 15,
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  qty: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  rowError: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footerBtn: { flex: 1 },
});

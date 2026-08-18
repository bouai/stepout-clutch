import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
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

import ListState, { type LoadStatus } from '../components/ListState';
import ScreenContainer from '../components/ScreenContainer';
import SwipeRow from '../components/SwipeRow';
import TripSwitcher from '../components/TripSwitcher';
import { apiRequest, describeError } from '../api';
import { useTripContext } from '../context/TripContext';
import { useCachedResource, invalidateResource } from '../hooks/useCachedResource';
import type {
  ChecklistCategory,
  ChecklistItem,
  InventoryItem,
  Weather,
} from '../types/models';
import { cardShadow, colors, radius, spacing } from '../theme';

const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;

type WeatherStatus = 'loading' | 'ready' | 'unavailable';

const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  'weather',
  'routine',
  'documents',
  'other',
];

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

async function patchChecklistItem(
  id: number,
  patch: Record<string, unknown>
): Promise<ChecklistItem> {
  return apiRequest<ChecklistItem>(`/checklist-items/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

export default function PlannerScreen() {
  const { currentTripId, maybeResetChecklist } = useTripContext();

  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('loading');
  const [usedDefaultLocation, setUsedDefaultLocation] = useState(false);
  const cacheKey = currentTripId ?? 'all';
  const {
    data: checklistData,
    status: checklistFetch,
    error: checklistError,
    refetch: refetchChecklist,
    mutate: mutateChecklist,
  } = useCachedResource<ChecklistItem[]>(
    `checklist:${cacheKey}`,
    currentTripId !== null ? `/checklist-items?tripId=${currentTripId}` : '/checklist-items'
  );
  const {
    data: inventoryData,
    refetch: refetchInventory,
    mutate: mutateInventory,
  } = useCachedResource<InventoryItem[]>(
    `inventory:${cacheKey}`,
    currentTripId !== null ? `/inventory-items?tripId=${currentTripId}` : '/inventory-items'
  );
  const checklistItems = checklistData ?? [];
  const inventoryItems = inventoryData ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const checklistStatus: LoadStatus =
    checklistFetch === 'loading'
      ? 'loading'
      : checklistFetch === 'error'
        ? 'error'
        : checklistItems.length === 0
          ? 'empty'
          : 'ready';

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLabel, setModalLabel] = useState('');
  const [modalCategory, setModalCategory] = useState<ChecklistCategory | null>(null);
  const [modalInventoryItemId, setModalInventoryItemId] = useState<number | null>(
    null
  );
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      const { latitude, longitude, usedDefault } = await resolveCoordinates();
      if (cancelled) return;
      setUsedDefaultLocation(usedDefault);

      try {
        const data = await apiRequest<Weather>('/weather', {
          query: { lat: latitude, lon: longitude },
        });
        if (!cancelled) {
          setWeather(data);
          setWeatherStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setWeatherStatus('unavailable');
        }
      }
    }

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLists = useCallback(async () => {
    // A recurring trip starts each day fresh — reset before refetching so the
    // unchecked state is what loads.
    if (currentTripId !== null) {
      await maybeResetChecklist(currentTripId);
    }
    await Promise.all([refetchChecklist(), refetchInventory()]);
  }, [currentTripId, maybeResetChecklist, refetchChecklist, refetchInventory]);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshLists();
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      refreshLists();
    }, [refreshLists])
  );

  function clearRowError(itemId: number) {
    setRowErrors((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function setLinkedInventoryPacked(inventoryItemId: number | null, isPacked: boolean) {
    if (inventoryItemId === null) return;
    mutateInventory((prev) =>
      (prev ?? []).map((row) =>
        row.id === inventoryItemId ? { ...row, isPacked } : row
      )
    );
  }

  async function toggleChecked(item: ChecklistItem) {
    const previousChecked = item.isChecked;
    const nextChecked = !previousChecked;

    clearRowError(item.id);
    mutateChecklist((prev) =>
      (prev ?? []).map((row) =>
        row.id === item.id ? { ...row, isChecked: nextChecked } : row
      )
    );
    setLinkedInventoryPacked(item.inventoryItemId, nextChecked);

    try {
      await patchChecklistItem(item.id, { isChecked: nextChecked });
      invalidateResource('inventory:');
    } catch {
      mutateChecklist((prev) =>
        (prev ?? []).map((row) =>
          row.id === item.id ? { ...row, isChecked: previousChecked } : row
        )
      );
      setLinkedInventoryPacked(item.inventoryItemId, previousChecked);
      setRowErrors((prev) => ({ ...prev, [item.id]: 'Could not save change' }));
    }
  }

  function beginLabelEdit(item: ChecklistItem) {
    clearRowError(item.id);
    setEditingItemId(item.id);
    setEditingLabel(item.label);
  }

  async function commitLabelEdit(item: ChecklistItem) {
    const trimmed = editingLabel.trim();
    setEditingItemId(null);

    if (trimmed.length === 0 || trimmed === item.label) {
      return;
    }

    const previousLabel = item.label;
    mutateChecklist((prev) =>
      (prev ?? []).map((row) =>
        row.id === item.id ? { ...row, label: trimmed } : row
      )
    );

    try {
      await patchChecklistItem(item.id, { label: trimmed });
    } catch {
      mutateChecklist((prev) =>
        (prev ?? []).map((row) =>
          row.id === item.id ? { ...row, label: previousLabel } : row
        )
      );
      setRowErrors((prev) => ({ ...prev, [item.id]: 'Could not save change' }));
    }
  }

  function confirmDelete(item: ChecklistItem) {
    Alert.alert(
      'Delete item?',
      `Delete "${item.label}"? This cannot be undone.`,
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

  async function performDelete(item: ChecklistItem) {
    const index = checklistItems.findIndex((row) => row.id === item.id);

    clearRowError(item.id);
    mutateChecklist((prev) => (prev ?? []).filter((row) => row.id !== item.id));

    try {
      await apiRequest<void>(`/checklist-items/${item.id}`, { method: 'DELETE' });
    } catch {
      mutateChecklist((prev) => {
        const next = [...(prev ?? [])];
        next.splice(index, 0, item);
        return next;
      });
      setRowErrors((prev) => ({ ...prev, [item.id]: 'Could not delete' }));
    }
  }

  function openAddModal() {
    setModalLabel('');
    setModalCategory(null);
    setModalInventoryItemId(null);
    setModalError(null);
    setModalVisible(true);
  }

  function closeAddModal() {
    setModalVisible(false);
    setModalLabel('');
    setModalCategory(null);
    setModalInventoryItemId(null);
    setModalError(null);
  }

  async function submitAddItem() {
    const trimmed = modalLabel.trim();
    if (trimmed.length === 0 || modalCategory === null) return;

    setModalSubmitting(true);
    setModalError(null);

    try {
      const created = await apiRequest<ChecklistItem>('/checklist-items', {
        method: 'POST',
        body: {
          label: trimmed,
          category: modalCategory,
          ...(modalInventoryItemId !== null
            ? { inventoryItemId: modalInventoryItemId }
            : {}),
          ...(currentTripId !== null ? { tripId: currentTripId } : {}),
        },
      });
      mutateChecklist((prev) => [...(prev ?? []), created]);
      if (modalInventoryItemId !== null) invalidateResource('inventory:');
      closeAddModal();
    } catch (error) {
      setModalError(describeError(error));
    } finally {
      setModalSubmitting(false);
    }
  }

  const canSubmitModal = modalLabel.trim().length > 0 && modalCategory !== null;

  return (
    <ScreenContainer
      title="Planner"
      onRefresh={handleRefresh}
      refreshing={refreshing}
      testID="planner-scroll"
    >
      <TripSwitcher />

      <View style={styles.card}>
        <View style={styles.weatherSection}>
          {weatherStatus === 'loading' && <ActivityIndicator />}
          {weatherStatus === 'ready' && weather && (
            <>
              <Text testID="weather-summary">
                {Math.round(weather.temperatureCelsius)}°C · {weather.condition}
              </Text>
              {usedDefaultLocation && (
                <Text style={styles.note}>Using default location</Text>
              )}
            </>
          )}
          {weatherStatus === 'unavailable' && (
            <Text testID="weather-unavailable">Weather unavailable</Text>
          )}
        </View>
      </View>

      <View style={[styles.card, styles.checklistCard]}>
        <View style={styles.checklistHeader}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          <Pressable onPress={openAddModal} testID="add-item-button">
            <Text style={styles.addButton}>+ Add Item</Text>
          </Pressable>
        </View>

        <View style={styles.checklistSection}>
          <ListState
            status={checklistStatus}
            emptyMessage="No checklist items yet"
            errorMessage={checklistError ?? undefined}
            onRetry={refetchChecklist}
            testIDPrefix="checklist"
          />
          {checklistStatus === 'ready' &&
            checklistItems.map((item) => (
            <View key={item.id} style={styles.checklistRow}>
              <SwipeRow
                onDelete={() => confirmDelete(item)}
                testID={`item-${item.id}`}
              >
              <View style={styles.checklistRowMain}>
                <Pressable
                  onPress={() => toggleChecked(item)}
                  testID={`checkbox-${item.id}`}
                  hitSlop={8}
                >
                  <Text style={styles.checkbox}>
                    {item.isChecked ? '☑' : '☐'}
                  </Text>
                </Pressable>

                {editingItemId === item.id ? (
                  <TextInput
                    style={styles.labelInput}
                    value={editingLabel}
                    onChangeText={setEditingLabel}
                    onBlur={() => commitLabelEdit(item)}
                    onSubmitEditing={() => commitLabelEdit(item)}
                    autoFocus
                    testID={`label-input-${item.id}`}
                  />
                ) : (
                  <Pressable
                    style={styles.labelPressable}
                    onPress={() => beginLabelEdit(item)}
                  >
                    <Text
                      style={item.isChecked ? styles.labelChecked : undefined}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )}

                {weatherStatus === 'ready' &&
                  weather &&
                  item.weatherCondition === weather.condition && (
                    <Text style={styles.todayTag}>Today</Text>
                  )}

                {item.inventoryItemId !== null &&
                  (() => {
                    const linkedInventoryItem = inventoryItems.find(
                      (inventoryItem) => inventoryItem.id === item.inventoryItemId
                    );
                    if (!linkedInventoryItem) return null;
                    return (
                      <Text
                        style={styles.inventoryBadge}
                        testID={`inventory-badge-${item.id}`}
                      >
                        {linkedInventoryItem.isPacked
                          ? '📦 Packed'
                          : '📦 Not packed'}
                      </Text>
                    );
                  })()}
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
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Add Item</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Label"
              value={modalLabel}
              onChangeText={setModalLabel}
              testID="modal-label-input"
            />

            <Picker
              selectedValue={modalCategory}
              onValueChange={(value) => setModalCategory(value)}
              testID="modal-category-picker"
            >
              <Picker.Item label="Select a category..." value={null} />
              {CHECKLIST_CATEGORIES.map((category) => (
                <Picker.Item key={category} label={category} value={category} />
              ))}
            </Picker>

            <Text style={styles.pickerLabel}>Link to inventory item</Text>
            <Picker
              selectedValue={modalInventoryItemId}
              onValueChange={(value) => setModalInventoryItemId(value)}
              testID="modal-inventory-picker"
            >
              <Picker.Item label="None" value={null} />
              {inventoryItems.map((inventoryItem) => (
                <Picker.Item
                  key={inventoryItem.id}
                  label={inventoryItem.name}
                  value={inventoryItem.id}
                />
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  checklistCard: {},
  weatherSection: {},
  note: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    color: colors.accent,
    fontWeight: '600',
  },
  checklistSection: {
    gap: 8,
  },
  checklistRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  checklistRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    fontSize: 18,
  },
  labelPressable: {
    flex: 1,
  },
  labelInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  labelChecked: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  todayTag: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  inventoryBadge: {
    fontSize: 12,
    color: colors.textSecondary,
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
  pickerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
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

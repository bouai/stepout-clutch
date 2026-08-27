import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import GlassCard from '../components/GlassCard';
import ListState, { type LoadStatus } from '../components/ListState';
import ScreenContainer from '../components/ScreenContainer';
import Sheet from '../components/Sheet';
import SwipeRow from '../components/SwipeRow';
import TripSwitcher from '../components/TripSwitcher';
import GuidanceCard from '../components/GuidanceCard';
import { Button, Checkbox, Chip, SectionLabel, TextField } from '../components/ui';
import { apiRequest, describeError } from '../api';
import { useTripContext } from '../context/TripContext';
import { useCachedResource, invalidateResource } from '../hooks/useCachedResource';
import type {
  ChecklistCategory,
  ChecklistItem,
  InventoryItem,
  Weather,
} from '../types/models';
import { colors, radius, spacing } from '../theme';

const DEFAULT_LATITUDE = 28.6139;
const DEFAULT_LONGITUDE = 77.209;

type WeatherStatus = 'loading' | 'ready' | 'unavailable';

const CHECKLIST_CATEGORIES: { value: ChecklistCategory; label: string }[] = [
  { value: 'weather', label: 'Weather' },
  { value: 'routine', label: 'Routine' },
  { value: 'documents', label: 'Documents' },
  { value: 'other', label: 'Other' },
];

async function resolveCoordinates(): Promise<{
  latitude: number;
  longitude: number;
  usedDefault: boolean;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE, usedDefault: true };
    }
    const position = await Location.getCurrentPositionAsync();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      usedDefault: false,
    };
  } catch {
    return { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE, usedDefault: true };
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
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      const { latitude, longitude } = await resolveCoordinates();
      if (cancelled) return;
      try {
        const data = await apiRequest<Weather>('/weather', {
          query: { lat: latitude, lon: longitude },
        });
        if (!cancelled) {
          setWeather(data);
          setWeatherStatus('ready');
        }
      } catch {
        if (!cancelled) setWeatherStatus('unavailable');
      }
    }
    loadWeather();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLists = useCallback(async () => {
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
      (prev ?? []).map((row) => (row.id === inventoryItemId ? { ...row, isPacked } : row))
    );
  }

  async function toggleChecked(item: ChecklistItem) {
    const previousChecked = item.isChecked;
    const nextChecked = !previousChecked;

    clearRowError(item.id);
    mutateChecklist((prev) =>
      (prev ?? []).map((row) => (row.id === item.id ? { ...row, isChecked: nextChecked } : row))
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
    if (trimmed.length === 0 || trimmed === item.label) return;

    const previousLabel = item.label;
    mutateChecklist((prev) =>
      (prev ?? []).map((row) => (row.id === item.id ? { ...row, label: trimmed } : row))
    );

    try {
      await patchChecklistItem(item.id, { label: trimmed });
    } catch {
      mutateChecklist((prev) =>
        (prev ?? []).map((row) => (row.id === item.id ? { ...row, label: previousLabel } : row))
      );
      setRowErrors((prev) => ({ ...prev, [item.id]: 'Could not save change' }));
    }
  }

  function confirmDelete(item: ChecklistItem) {
    Alert.alert('Delete item?', `Delete "${item.label}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDelete(item) },
    ]);
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
    setModalError(null);
    setModalVisible(true);
  }

  function closeAddModal() {
    setModalVisible(false);
    setModalLabel('');
    setModalCategory(null);
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
          ...(currentTripId !== null ? { tripId: currentTripId } : {}),
        },
      });
      mutateChecklist((prev) => [...(prev ?? []), created]);
      closeAddModal();
    } catch (error) {
      setModalError(describeError(error));
    } finally {
      setModalSubmitting(false);
    }
  }

  const canSubmitModal = modalLabel.trim().length > 0 && modalCategory !== null;
  const doneCount = checklistItems.filter((i) => i.isChecked).length;

  return (
    <ScreenContainer
      title="Planner"
      onRefresh={handleRefresh}
      refreshing={refreshing}
      testID="planner-scroll"
    >
      <TripSwitcher />

      <GuidanceCard
        id="planner"
        title="This is where you get ready"
        body="Tick items off as you prepare. StepOut suggests weather-aware items, and packing stays in sync with your inventory."
      />

      {weatherStatus === 'ready' && weather && (
        <GlassCard style={styles.weatherStrip}>
          <Text style={styles.weatherStripText}>
            {weatherIcon(weather.condition)}  {Math.round(weather.temperatureCelsius)}°C ·{' '}
            {conditionLabel(weather.condition)}
          </Text>
        </GlassCard>
      )}

      <GlassCard style={styles.checklistCard} tone="hero">
        <View style={styles.checklistHeader}>
          <View>
            <Text style={styles.sectionTitle}>Checklist</Text>
            <Text style={styles.progressText}>
              {doneCount} of {checklistItems.length} done
            </Text>
          </View>
          <Pressable style={styles.addPill} onPress={openAddModal} testID="add-item-button">
            <Text style={styles.addPillText}>＋ Add</Text>
          </Pressable>
        </View>

        <View style={styles.checklistSection}>
          <ListState
            status={checklistStatus}
            emptyMessage="No checklist items yet — add one or create a trip to get a starter list."
            errorMessage={checklistError ?? undefined}
            onRetry={refetchChecklist}
            testIDPrefix="checklist"
          />
          {checklistStatus === 'ready' &&
            checklistItems.map((item) => (
              <View key={item.id} style={styles.checklistRow}>
                <SwipeRow onDelete={() => confirmDelete(item)} testID={`item-${item.id}`}>
                  <View style={styles.checklistRowMain}>
                    <Checkbox
                      checked={item.isChecked}
                      onPress={() => toggleChecked(item)}
                      testID={`checkbox-${item.id}`}
                    />
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
                        <Text style={item.isChecked ? styles.labelChecked : styles.label}>
                          {item.label}
                        </Text>
                      </Pressable>
                    )}

                    {weatherStatus === 'ready' &&
                      weather &&
                      item.weatherCondition === weather.condition && (
                        <View style={styles.todayTag}>
                          <Text style={styles.todayTagText}>Today</Text>
                        </View>
                      )}

                    {item.inventoryItemId !== null &&
                      (() => {
                        const linked = inventoryItems.find(
                          (inv) => inv.id === item.inventoryItemId
                        );
                        if (!linked) return null;
                        return (
                          <Text
                            style={styles.inventoryBadge}
                            testID={`inventory-badge-${item.id}`}
                          >
                            {linked.isPacked ? '📦 Packed' : '📦 Not packed'}
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
      </GlassCard>

      <Sheet
        visible={modalVisible}
        onClose={closeAddModal}
        title="Add checklist item"
        testID="planner-add-sheet"
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
          <SectionLabel>What do you need to do?</SectionLabel>
          <TextField
            value={modalLabel}
            onChangeText={setModalLabel}
            placeholder="e.g. Charge laptop overnight"
            autoFocus
            testID="modal-label-input"
          />
        </View>
        <View style={styles.fieldGroup}>
          <SectionLabel>Category</SectionLabel>
          <View style={styles.categoryGrid}>
            {CHECKLIST_CATEGORIES.map((cat) => (
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

function weatherIcon(condition: string): string {
  switch (condition) {
    case 'rain':
      return '🌧';
    case 'snow':
      return '❄️';
    case 'extreme-heat':
      return '☀️';
    case 'extreme-cold':
      return '🥶';
    case 'wind':
      return '💨';
    default:
      return '⛅';
  }
}

function conditionLabel(condition: string): string {
  const map: Record<string, string> = {
    rain: 'Rain expected',
    snow: 'Snow expected',
    'extreme-heat': 'Very hot',
    'extreme-cold': 'Very cold',
    wind: 'Windy',
    clear: 'Clear',
  };
  return map[condition] ?? condition;
}

const styles = StyleSheet.create({
  weatherStrip: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  weatherStripText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  checklistCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  progressText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
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
  checklistSection: {
    gap: 2,
  },
  checklistRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  checklistRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  labelPressable: {
    flex: 1,
  },
  labelInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.accentBorder,
    paddingVertical: 2,
  },
  labelChecked: {
    flex: 1,
    fontSize: 15,
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  todayTag: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  todayTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.navIconActive,
  },
  inventoryBadge: {
    fontSize: 12,
    color: colors.textSecondary,
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

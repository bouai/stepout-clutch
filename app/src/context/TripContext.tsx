import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { apiRequest } from '../api';
import type { TemplateApplied, Trip, TripType } from '../types/models';

const SELECTED_TRIP_KEY = 'stepout_selected_trip_id';

export interface TripCoords {
  latitude: number;
  longitude: number;
}

export interface CreateTripOptions {
  coords?: TripCoords;
  tripType?: TripType;
  isRecurring?: boolean;
}

export interface CreateTripResult {
  trip: Trip;
  /** Present when a type was chosen and its template was applied. */
  applied: TemplateApplied | null;
}

/** The device's local date as YYYY-MM-DD — the "day" a reset is keyed to. */
function localDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface TripContextValue {
  trips: Trip[];
  currentTripId: number | null;
  /** False until the persisted selection has been read back from storage. */
  ready: boolean;
  selectTrip: (tripId: number | null) => void;
  createTrip: (
    name: string,
    options?: CreateTripOptions
  ) => Promise<CreateTripResult | null>;
  renameTrip: (
    tripId: number,
    name: string,
    coords?: TripCoords
  ) => Promise<boolean>;
  deleteTrip: (tripId: number) => Promise<boolean>;
  refreshTrips: () => Promise<void>;
  /**
   * If the trip is recurring and its checklist was last reset before today,
   * uncheck it for the new day. Safe to call on every screen focus.
   */
  maybeResetChecklist: (tripId: number) => Promise<boolean>;
}

const TripContext = createContext<TripContextValue | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentTripId, setCurrentTripId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const refreshTrips = useCallback(async () => {
    try {
      const data = await apiRequest<Trip[]>('/trips');
      setTrips(data);
    } catch {
      setTrips([]);
    }
  }, []);

  useEffect(() => {
    refreshTrips();
  }, [refreshTrips]);

  // Trip selection used to be in-memory only, so every cold start silently
  // dropped the user back to "All" no matter which trip they were on.
  useEffect(() => {
    let cancelled = false;

    async function restoreSelection() {
      try {
        const stored = await AsyncStorage.getItem(SELECTED_TRIP_KEY);
        if (!cancelled && stored !== null) {
          const parsed = Number(stored);
          if (Number.isInteger(parsed)) setCurrentTripId(parsed);
        }
      } catch {
        // A missing selection just means "All"; nothing to recover.
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    restoreSelection();

    return () => {
      cancelled = true;
    };
  }, []);

  // Drop a stored selection that points at a trip the server no longer has,
  // otherwise every screen filters on a dead id and renders empty forever.
  useEffect(() => {
    if (!ready || currentTripId === null) return;
    if (trips.length > 0 && !trips.some((trip) => trip.id === currentTripId)) {
      selectTrip(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trips, currentTripId]);

  function selectTrip(tripId: number | null) {
    setCurrentTripId(tripId);
    const write =
      tripId === null
        ? AsyncStorage.removeItem(SELECTED_TRIP_KEY)
        : AsyncStorage.setItem(SELECTED_TRIP_KEY, String(tripId));
    write.catch(() => {
      // Selection still applies this session even if it cannot be persisted.
    });
  }

  async function createTrip(
    name: string,
    options?: CreateTripOptions
  ): Promise<CreateTripResult | null> {
    const { coords, tripType, isRecurring } = options ?? {};
    try {
      // Without coordinates a trip can never drive Home's weather card,
      // which is why the create form offers to capture them.
      const created = await apiRequest<Trip>('/trips', {
        method: 'POST',
        body: {
          name,
          ...(coords ?? {}),
          ...(tripType ? { tripType } : {}),
          ...(isRecurring ? { isRecurring: true } : {}),
        },
      });

      // A type means the user wants the trip set up for them; apply its
      // template so the checklist, packing list and arrival zone exist before
      // they ever open a tab. A failure here must not lose the trip itself.
      let applied: TemplateApplied | null = null;
      let finalTrip = created;
      if (tripType) {
        try {
          applied = await apiRequest<TemplateApplied>(
            `/trips/${created.id}/apply-template`,
            { method: 'POST' }
          );
          finalTrip = { ...created, templateApplied: true };
        } catch {
          // Leave `applied` null; the trip is created, just not pre-filled.
        }
      }

      setTrips((prev) => [...prev, finalTrip]);
      selectTrip(finalTrip.id);
      return { trip: finalTrip, applied };
    } catch {
      return null;
    }
  }

  async function renameTrip(
    tripId: number,
    name: string,
    coords?: TripCoords
  ): Promise<boolean> {
    try {
      const updated = await apiRequest<Trip>(`/trips/${tripId}`, {
        method: 'PATCH',
        body: { name, ...(coords ?? {}) },
      });
      setTrips((prev) => prev.map((trip) => (trip.id === tripId ? updated : trip)));
      return true;
    } catch {
      return false;
    }
  }

  async function deleteTrip(tripId: number): Promise<boolean> {
    try {
      await apiRequest<void>(`/trips/${tripId}`, { method: 'DELETE' });
      setTrips((prev) => prev.filter((trip) => trip.id !== tripId));
      if (currentTripId === tripId) selectTrip(null);
      return true;
    } catch {
      return false;
    }
  }

  async function maybeResetChecklist(tripId: number): Promise<boolean> {
    const trip = trips.find((candidate) => candidate.id === tripId);
    const today = localDate();
    if (!trip || !trip.isRecurring || trip.checklistResetOn === today) {
      return false;
    }
    try {
      await apiRequest(`/trips/${tripId}/reset-checklist`, {
        method: 'POST',
        query: { date: today },
      });
      // Record the reset locally so a second focus the same day is a no-op.
      setTrips((prev) =>
        prev.map((candidate) =>
          candidate.id === tripId
            ? { ...candidate, checklistResetOn: today }
            : candidate
        )
      );
      return true;
    } catch {
      return false;
    }
  }

  return (
    <TripContext.Provider
      value={{
        trips,
        currentTripId,
        ready,
        selectTrip,
        createTrip,
        renameTrip,
        deleteTrip,
        refreshTrips,
        maybeResetChecklist,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTripContext(): TripContextValue {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTripContext must be used within a TripProvider');
  }
  return context;
}

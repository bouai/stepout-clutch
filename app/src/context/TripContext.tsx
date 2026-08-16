import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type { Trip } from '../types/models';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const SELECTED_TRIP_KEY = 'stepout_selected_trip_id';

interface TripContextValue {
  trips: Trip[];
  currentTripId: number | null;
  /** False until the persisted selection has been read back from storage. */
  ready: boolean;
  selectTrip: (tripId: number | null) => void;
  createTrip: (name: string) => Promise<Trip | null>;
  renameTrip: (tripId: number, name: string) => Promise<boolean>;
  deleteTrip: (tripId: number) => Promise<boolean>;
  refreshTrips: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentTripId, setCurrentTripId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const refreshTrips = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/trips`);
      if (!response.ok) throw new Error('trips request failed');
      const data: Trip[] = await response.json();
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

  async function createTrip(name: string): Promise<Trip | null> {
    try {
      const response = await fetch(`${API_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('create trip failed');
      const created: Trip = await response.json();
      setTrips((prev) => [...prev, created]);
      selectTrip(created.id);
      return created;
    } catch {
      return null;
    }
  }

  async function renameTrip(tripId: number, name: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('rename trip failed');
      const updated: Trip = await response.json();
      setTrips((prev) => prev.map((trip) => (trip.id === tripId ? updated : trip)));
      return true;
    } catch {
      return false;
    }
  }

  async function deleteTrip(tripId: number): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/trips/${tripId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('delete trip failed');
      setTrips((prev) => prev.filter((trip) => trip.id !== tripId));
      if (currentTripId === tripId) selectTrip(null);
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

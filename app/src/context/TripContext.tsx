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

interface TripContextValue {
  trips: Trip[];
  currentTripId: number | null;
  selectTrip: (tripId: number | null) => void;
  createTrip: (name: string) => Promise<Trip | null>;
}

const TripContext = createContext<TripContextValue | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentTripId, setCurrentTripId] = useState<number | null>(null);

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
      setCurrentTripId(created.id);
      return created;
    } catch {
      return null;
    }
  }

  function selectTrip(tripId: number | null) {
    setCurrentTripId(tripId);
  }

  return (
    <TripContext.Provider
      value={{ trips, currentTripId, selectTrip, createTrip }}
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

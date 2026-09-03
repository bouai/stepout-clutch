import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'stepout_guidance_dismissed_v1';

/**
 * Tracks which one-time contextual coach cards a user has dismissed, persisted
 * across launches. Each guidance card has a stable id; once dismissed it never
 * shows again. A tiny in-memory listener set keeps multiple mounted cards in
 * sync within a session so dismissing one updates the others immediately.
 */
let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    cache = new Set<string>();
  }
  return cache;
}

async function persist() {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...cache]));
  } catch {
    // Non-fatal: guidance may reappear next launch if this write fails.
  }
}

export function useGuidance(id: string) {
  const [ready, setReady] = useState(cache !== null);
  const [dismissed, setDismissed] = useState(() => cache?.has(id) ?? false);

  useEffect(() => {
    let active = true;
    load().then((set) => {
      if (!active) return;
      setDismissed(set.has(id));
      setReady(true);
    });
    const listener = () => setDismissed(cache?.has(id) ?? false);
    listeners.add(listener);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, [id]);

  const dismiss = useCallback(() => {
    if (!cache) cache = new Set<string>();
    cache.add(id);
    setDismissed(true);
    listeners.forEach((l) => l());
    void persist();
  }, [id]);

  return { ready, dismissed, dismiss };
}

/** Reset all guidance (used by the "Replay tips" affordance in Settings). */
export async function resetGuidance() {
  cache = new Set<string>();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
  listeners.forEach((l) => l());
}

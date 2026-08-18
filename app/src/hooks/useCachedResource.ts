import { useCallback, useEffect, useRef, useState } from 'react';

import { apiRequest, ApiError, describeError } from '../api';

/**
 * A tiny stale-while-revalidate cache.
 *
 * Every screen used to refetch from scratch on focus and show a spinner while
 * it did — so flipping between tabs flashed empty and felt laggy even when
 * nothing had changed. This cache keeps the last successful value per key, hands
 * it back instantly on the next focus, and refreshes in the background.
 *
 * Module-level so the cache outlives any one screen; cleared on sign-out.
 */
const store = new Map<string, unknown>();

export function clearResourceCache(): void {
  store.clear();
}

/** Drops cached entries whose key contains the substring — used after writes. */
export function invalidateResource(fragment: string): void {
  for (const key of [...store.keys()]) {
    if (key.includes(fragment)) store.delete(key);
  }
}

/** Lets a screen seed the cache after a local mutation, avoiding a refetch flash. */
export function setCachedResource<T>(key: string, value: T): void {
  store.set(key, value);
}

export function getCachedResource<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export type ResourceStatus = 'loading' | 'ready' | 'error';

export interface CachedResource<T> {
  data: T | undefined;
  /** `loading` only when there is nothing cached to show yet. */
  status: ResourceStatus;
  error: string | null;
  refetch: () => Promise<void>;
  /** Optimistically replace the local value (e.g. after a toggle). */
  mutate: (updater: (current: T | undefined) => T) => void;
}

/**
 * @param key      cache identity; include query params so scopes don't collide
 * @param path     API path to fetch when revalidating
 * @param enabled  skip fetching entirely (e.g. no trip selected yet)
 */
export function useCachedResource<T>(
  key: string,
  path: string,
  enabled = true
): CachedResource<T> {
  const cached = store.get(key) as T | undefined;
  const [data, setData] = useState<T | undefined>(cached);
  const [status, setStatus] = useState<ResourceStatus>(
    cached !== undefined ? 'ready' : 'loading'
  );
  const [error, setError] = useState<string | null>(null);

  // Avoids a slow earlier response overwriting a newer one, and setState after
  // unmount.
  const requestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;

    // Only show the spinner when we have nothing cached; otherwise revalidate
    // silently behind the data already on screen.
    if (store.get(key) === undefined) setStatus('loading');

    try {
      const fresh = await apiRequest<T>(path);
      if (!mounted.current || id !== requestId.current) return;
      store.set(key, fresh);
      setData(fresh);
      setStatus('ready');
      setError(null);
    } catch (err) {
      if (!mounted.current || id !== requestId.current) return;
      // Keep showing stale data on a failed refresh; only surface an error when
      // there is nothing to show.
      if (store.get(key) === undefined) {
        setStatus('error');
        setError(err instanceof ApiError ? describeError(err) : 'Something went wrong.');
      }
    }
  }, [key, path, enabled]);

  // Re-sync from the cache when the key changes (e.g. switching trips), so the
  // new scope's cached data shows instantly instead of the previous scope's.
  useEffect(() => {
    const current = store.get(key) as T | undefined;
    setData(current);
    setStatus(current !== undefined ? 'ready' : 'loading');
    setError(null);
    refetch();
  }, [key, refetch]);

  const mutate = useCallback(
    (updater: (current: T | undefined) => T) => {
      setData((current) => {
        const next = updater(current);
        store.set(key, next);
        return next;
      });
    },
    [key]
  );

  return { data, status, error, refetch, mutate };
}

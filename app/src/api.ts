/**
 * Single source of truth for the backend base URL and fetch behaviour.
 *
 * The URL was previously redeclared in six files, each defaulting to
 * `http://localhost:8000` — which resolves to the *phone* on a device, so a
 * build handed to anyone else silently reached nothing.
 *
 * `EXPO_PUBLIC_API_URL` is inlined at bundle time, so a build carries whatever
 * was set when it was made. Set it to a deployed URL for builds you hand out;
 * set it to your LAN IP for local device testing.
 */

const CONFIGURED_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

/**
 * Used when nothing is configured. localhost is correct for the web/simulator
 * case and useless on a physical device — which is why `isLocalOnly` exists,
 * so the UI can say so instead of showing an unexplained failure.
 */
const FALLBACK_URL = 'http://localhost:8000';

export const API_URL = (CONFIGURED_URL || FALLBACK_URL).replace(/\/+$/, '');

/** True when the app is pointed at a host only reachable from this machine. */
export const isLocalOnly = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(API_URL);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// The bearer token for the signed-in account. Held in module scope so every
// request can attach it without threading it through each call; AuthContext
// keeps it in sync with storage.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Notified on any 401, so the app can drop back to the login screen. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Distinguishes "server said no" from "could not reach the server at all". */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === undefined) {
      return isLocalOnly
        ? 'Cannot reach the server. This build points at localhost, which a phone cannot see.'
        : 'Cannot reach the server. Check your connection.';
    }
    if (error.status === 404) return 'Not found.';
    if (error.status >= 500) return 'The server had a problem. Try again.';
    return 'That request was rejected.';
  }
  return 'Something went wrong.';
}

function buildUrl(path: string, query?: Record<string, string | number | null | undefined>) {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const params = Object.entries(query)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return params.length > 0 ? `${url}?${params.join('&')}` : url;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | null | undefined>;
  body?: unknown;
}

/**
 * Throws {@link ApiError} on both transport failure and non-2xx responses, so
 * callers can tell an empty result from a failed one. Screens used to swallow
 * every failure into an empty array, which rendered "No items yet" for an
 * unreachable server and read to testers as data loss.
 */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', query, body }: RequestOptions = {}
): Promise<T> {
  let response: Response;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new ApiError(`Could not reach ${API_URL}`, undefined, cause);
  }

  if (!response.ok) {
    // A 401 means the session is gone; let the app return to login rather than
    // surfacing a generic error on every screen.
    if (response.status === 401) onUnauthorized?.();
    throw new ApiError(`${method} ${path} failed`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

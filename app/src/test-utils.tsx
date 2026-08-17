import { NavigationContainer } from '@react-navigation/native';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TripProvider } from './context/TripContext';

/** Fixed frame so `useSafeAreaInsets` returns deterministic values in tests. */
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// NavigationContainer is required because screens use `useFocusEffect`, which
// throws without a navigation context.
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <NavigationContainer>
        <TripProvider>{children}</TripProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// RNTL 14's `render` is async — awaiting it is what populates `screen` and
// returns the query helpers.
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/** Renders without TripProvider, for components that supply their own. */
export function renderWithSafeArea(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>{children}</SafeAreaProvider>
    ),
    ...options,
  });
}

interface RouteStub {
  /** Matched as a substring of the request URL. */
  match: string;
  body: unknown;
  ok?: boolean;
  /**
   * Restrict the route to one HTTP method. Needed when a list GET and a create
   * POST share a path (`/trips`) but must return different shapes.
   */
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
}

/**
 * Routes `fetch` calls to canned bodies by URL substring (and optional method).
 *
 * Order matters — the first matching route wins, so register the more specific
 * path first (`/saved-destinations/1/distance` before `/saved-destinations`).
 */
export function stubFetch(routes: RouteStub[]) {
  const mock = global.fetch as jest.Mock;
  mock.mockImplementation((url: string, init?: { method?: string }) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const route = routes.find(
      (candidate) =>
        String(url).includes(candidate.match) &&
        (candidate.method === undefined || candidate.method === method)
    );
    if (!route) {
      return Promise.reject(new Error(`No stub registered for ${method} ${url}`));
    }
    return Promise.resolve({
      ok: route.ok ?? true,
      status: route.ok === false ? 500 : 200,
      json: async () => route.body,
    });
  });
  return mock;
}

export * from '@testing-library/react-native';

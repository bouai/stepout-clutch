import * as Location from 'expo-location';

import HomeScreen from '../HomeScreen';
import { renderWithProviders, stubFetch, waitFor } from '../../test-utils';

const WEATHER = {
  temperatureCelsius: 18.4,
  windSpeedKmh: 22,
  condition: 'rain',
  fetchedAt: '2026-08-16T07:00:00Z',
};

function baseRoutes(overrides: Record<string, unknown> = {}) {
  return [
    { match: '/trips', body: overrides.trips ?? [] },
    { match: '/weather', body: overrides.weather ?? WEATHER },
    { match: '/checklist-items', body: overrides.checklist ?? [] },
    { match: '/inventory-items', body: overrides.inventory ?? [] },
    // More specific path first — stubFetch takes the first match.
    { match: '/distance', body: overrides.distance ?? { distanceKm: 5.1, bearingDegrees: 90 } },
    { match: '/saved-destinations', body: overrides.destinations ?? [] },
    { match: '/geofence-triggers/', body: overrides.trigger ?? { id: 1, label: 'Shinjuku' } },
    { match: '/geofence-events', body: overrides.events ?? [] },
  ] as { match: string; body: unknown }[];
}

describe('HomeScreen', () => {
  it('renders weather once loaded', async () => {
    stubFetch(baseRoutes());
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() =>
      expect(view.getByTestId('home-weather-summary')).toBeTruthy()
    );
    expect(view.getByTestId('home-weather-summary').props.children).toContain(18);
  });

  it('shows an unavailable state when weather fails', async () => {
    stubFetch([...baseRoutes(), { match: '/weather', body: null, ok: false }].reverse());
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() =>
      expect(view.getByTestId('home-weather-unavailable')).toBeTruthy()
    );
  });

  it('reports empty states for destinations and alerts', async () => {
    stubFetch(baseRoutes());
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() => expect(view.getByTestId('home-up-next-empty')).toBeTruthy());
    expect(view.getByTestId('home-latest-alert-empty')).toBeTruthy();
  });

  it('shows the nearest destination with its distance', async () => {
    stubFetch(
      baseRoutes({
        destinations: [
          { id: 1, label: 'Tsukiji Market', latitude: 35.66, longitude: 139.77 },
        ],
      })
    );
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() =>
      expect(view.getByTestId('home-up-next-summary')).toBeTruthy()
    );
    const text = view.getByTestId('home-up-next-summary').props.children.join('');
    expect(text).toContain('Tsukiji Market');
    expect(text).toContain('5.1');
  });

  it('renders progress rings from checklist and packing data', async () => {
    stubFetch(
      baseRoutes({
        checklist: [
          { id: 1, label: 'Passport', category: 'documents', isChecked: true },
          { id: 2, label: 'Umbrella', category: 'weather', isChecked: false },
        ],
        inventory: [
          { id: 1, name: 'Laptop', category: 'electronics', isPacked: true, quantity: 1 },
        ],
      })
    );
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() =>
      expect(view.getByTestId('home-checklist-ring')).toBeTruthy()
    );
    expect(view.getByTestId('home-packing-ring')).toBeTruthy();
  });

  it('resolves device location exactly once per load', async () => {
    stubFetch(
      baseRoutes({
        destinations: [{ id: 1, label: 'Hotel', latitude: 35.6, longitude: 139.7 }],
      })
    );
    await renderWithProviders(<HomeScreen />);

    // Weather and "up next" both need coordinates. They used to request
    // permission and take a GPS fix independently, prompting the user twice.
    await waitFor(() =>
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled()
    );
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('is scrollable so the last card stays reachable', async () => {
    stubFetch(baseRoutes());
    const view = await renderWithProviders(<HomeScreen />);

    const scroll = view.getByTestId('home-scroll');
    expect(scroll.props.contentContainerStyle).toBeTruthy();
    expect(scroll.props.refreshControl).toBeTruthy();
  });

  it('requests geofence events scoped to nothing when no trip is selected', async () => {
    stubFetch(baseRoutes());
    await renderWithProviders(<HomeScreen />);

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('/geofence-events?limit=1'))).toBe(true);
    });
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((url) => url.includes('/geofence-events') && url.includes('tripId'))).toBe(
      false
    );
  });
});

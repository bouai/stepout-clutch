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
    expect(view.getByTestId('home-up-next-summary').props.children).toBe(
      'Tsukiji Market'
    );
    expect(view.getByText('5.1 km away')).toBeTruthy();
  });

  it('shows one combined readiness figure with the sub-counts', async () => {
    stubFetch(
      baseRoutes({
        checklist: [
          { id: 1, label: 'Passport', category: 'documents', isChecked: true },
          { id: 2, label: 'Umbrella', category: 'weather', isChecked: false },
          { id: 3, label: 'Charger', category: 'other', isChecked: false },
        ],
        inventory: [
          { id: 1, name: 'Laptop', category: 'electronics', isPacked: true, quantity: 1 },
          { id: 2, name: 'Cable', category: 'electronics', isPacked: false, quantity: 1 },
        ],
      })
    );
    const view = await renderWithProviders(<HomeScreen />);

    // 2 of 5 items done across both lists → 40%.
    await waitFor(() =>
      expect(view.getByTestId('home-ready-ring-fraction')).toBeTruthy()
    );
    expect(view.getByTestId('home-ready-ring-fraction').props.children).toBe('40%');
    expect(view.getByTestId('home-checklist-count').props.children.join('')).toContain(
      '1/3'
    );
    expect(view.getByTestId('home-packing-count').props.children.join('')).toContain(
      '1/2'
    );
  });

  it('shows the daily high and low when the API returns them', async () => {
    stubFetch(baseRoutes({ weather: { ...WEATHER, highCelsius: 21.4, lowCelsius: 13.8 } }));
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() => expect(view.getByTestId('home-weather-range')).toBeTruthy());
    expect(
      view.getByTestId('home-weather-range').props.children.join('')
    ).toContain('21');
  });

  it('omits the high/low row when the provider did not supply a daily block', async () => {
    stubFetch(
      baseRoutes({ weather: { ...WEATHER, highCelsius: null, lowCelsius: null } })
    );
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() =>
      expect(view.getByTestId('home-weather-summary')).toBeTruthy()
    );
    expect(view.queryByTestId('home-weather-range')).toBeNull();
  });

  it('describes the alert direction in words rather than an enum value', async () => {
    stubFetch(
      baseRoutes({
        events: [
          {
            id: 1,
            triggerId: 1,
            direction: 'enter',
            firedAt: new Date().toISOString(),
            tripId: null,
          },
        ],
      })
    );
    const view = await renderWithProviders(<HomeScreen />);

    await waitFor(() =>
      expect(view.getByTestId('home-latest-alert-summary')).toBeTruthy()
    );
    expect(
      view.getByTestId('home-latest-alert-summary').props.children.join('')
    ).toContain('Entered Shinjuku');
  });

  it('renders the readiness ring from checklist and packing data', async () => {
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

    await waitFor(() => expect(view.getByTestId('home-ready')).toBeTruthy());
    // 2 of 3 done → 67%.
    expect(view.getByTestId('home-ready-ring-fraction').props.children).toBe('67%');
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

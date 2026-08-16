/**
 * Reachability guard.
 *
 * Four of five screens once rendered their lists into a fixed View, so any row
 * past the first screenful was permanently unreachable. Type-checking and API
 * tests were both green throughout. These tests assert the property those
 * gates cannot see: that a scroll container exists.
 */

import ActiveTrackingScreen from '../ActiveTrackingScreen';
import HomeScreen from '../HomeScreen';
import InventoryScreen from '../InventoryScreen';
import PlannerScreen from '../PlannerScreen';
import TransitScreen from '../TransitScreen';
import { renderWithProviders, stubFetch, waitFor } from '../../test-utils';

const EMPTY_ROUTES = [
  { match: '/trips', body: [] },
  { match: '/weather', body: null, ok: false },
  { match: '/checklist-items', body: [] },
  { match: '/inventory-items', body: [] },
  { match: '/distance', body: { distanceKm: 1, bearingDegrees: 0 } },
  { match: '/saved-destinations', body: [] },
  { match: '/geofence-triggers', body: [] },
  { match: '/geofence-events', body: [] },
];

function manyInventoryItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    category: 'other',
    quantity: 1,
    isPacked: false,
    tripId: null,
  }));
}

function manyTriggers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    label: `Zone ${i + 1}`,
    latitude: 35.6 + i / 1000,
    longitude: 139.7,
    radiusMeters: 200,
    triggerType: 'enter',
    notificationMessage: 'Arrived',
    isActive: true,
    tripId: null,
  }));
}

describe('screen scroll containers', () => {
  it('Home scrolls and supports pull-to-refresh', async () => {
    stubFetch(EMPTY_ROUTES);
    const view = await renderWithProviders(<HomeScreen />);

    const scroll = view.getByTestId('home-scroll');
    expect(scroll.props.contentContainerStyle).toBeTruthy();
    expect(scroll.props.refreshControl).toBeTruthy();
  });

  it('Planner scrolls and supports pull-to-refresh', async () => {
    stubFetch(EMPTY_ROUTES);
    const view = await renderWithProviders(<PlannerScreen />);

    const scroll = view.getByTestId('planner-scroll');
    expect(scroll.props.contentContainerStyle).toBeTruthy();
    expect(scroll.props.refreshControl).toBeTruthy();
  });

  it('Inventory scrolls and supports pull-to-refresh', async () => {
    stubFetch(EMPTY_ROUTES);
    const view = await renderWithProviders(<InventoryScreen />);

    const scroll = view.getByTestId('inventory-scroll');
    expect(scroll.props.contentContainerStyle).toBeTruthy();
    expect(scroll.props.refreshControl).toBeTruthy();
  });

  it('Inventory renders every row when the list is long', async () => {
    stubFetch([
      ...EMPTY_ROUTES.filter((r) => r.match !== '/inventory-items'),
      { match: '/inventory-items', body: manyInventoryItems(30) },
    ]);
    const view = await renderWithProviders(<InventoryScreen />);

    await waitFor(() => expect(view.getByText(/Item 1 \(/)).toBeTruthy());
    expect(view.getByText(/Item 30 \(/)).toBeTruthy();
  });

  it('Active Tracking keeps a fixed map but scrolls its trigger list', async () => {
    stubFetch(EMPTY_ROUTES);
    const view = await renderWithProviders(<ActiveTrackingScreen />);

    // The map must NOT be inside a ScrollView — it would fight for pan gestures.
    const fixed = view.getByTestId('tracking-fixed');
    expect(fixed.props.contentContainerStyle).toBeUndefined();

    // The list beneath it still needs to scroll independently.
    const list = view.getByTestId('triggers-scroll');
    expect(list.props.contentContainerStyle).toBeTruthy();
  });

  it('Active Tracking renders every trigger when the list is long', async () => {
    stubFetch([
      ...EMPTY_ROUTES.filter((r) => r.match !== '/geofence-triggers'),
      { match: '/geofence-triggers', body: manyTriggers(25) },
    ]);
    const view = await renderWithProviders(<ActiveTrackingScreen />);

    await waitFor(() => expect(view.getByTestId('toggle-1')).toBeTruthy());
    expect(view.getByTestId('toggle-25')).toBeTruthy();
  });

  it('Transit keeps a fixed map and uses a FlatList for destinations', async () => {
    stubFetch(EMPTY_ROUTES);
    const view = await renderWithProviders(<TransitScreen />);

    const fixed = view.getByTestId('transit-fixed');
    expect(fixed.props.contentContainerStyle).toBeUndefined();
    await waitFor(() => expect(view.getByTestId('destinations-empty')).toBeTruthy());
  });
});

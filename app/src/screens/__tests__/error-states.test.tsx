/**
 * An unreachable server must not look like an empty account.
 *
 * Every screen used to catch a failed fetch and render the empty state, so a
 * tester whose phone could not reach the backend saw "No items yet" and
 * reasonably reported that their data had been deleted.
 */

import ActiveTrackingScreen from '../ActiveTrackingScreen';
import InventoryScreen from '../InventoryScreen';
import PlannerScreen from '../PlannerScreen';
import TransitScreen from '../TransitScreen';
import { fireEvent, renderWithProviders, stubFetch, waitFor } from '../../test-utils';

/** Simulates the server being unreachable, as opposed to returning no rows. */
function stubUnreachable() {
  const mock = global.fetch as jest.Mock;
  mock.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
  return mock;
}

/** Simulates the server answering, but with an error status. */
function stubServerError() {
  const mock = global.fetch as jest.Mock;
  mock.mockImplementation(() =>
    Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
  );
  return mock;
}

const EMPTY_OK = [
  { match: '/trips', body: [] },
  { match: '/weather', body: null, ok: false },
  { match: '/checklist-items', body: [] },
  { match: '/inventory-items', body: [] },
  { match: '/saved-destinations', body: [] },
  { match: '/geofence-triggers', body: [] },
  { match: '/geofence-events', body: [] },
];

const SCREENS = [
  ['Inventory', InventoryScreen, 'inventory'],
  ['Planner', PlannerScreen, 'checklist'],
  ['Transit', TransitScreen, 'destinations'],
  ['Active Tracking', ActiveTrackingScreen, 'triggers'],
] as const;

describe.each(SCREENS)('%s error states', (_name, Screen, prefix) => {
  it('shows an error, not the empty state, when the server is unreachable', async () => {
    stubUnreachable();
    const view = await renderWithProviders(<Screen />);

    await waitFor(() => expect(view.getByTestId(`${prefix}-error`)).toBeTruthy());
    expect(view.queryByTestId(`${prefix}-empty`)).toBeNull();
  });

  it('shows an error when the server responds 500', async () => {
    stubServerError();
    const view = await renderWithProviders(<Screen />);

    await waitFor(() => expect(view.getByTestId(`${prefix}-error`)).toBeTruthy());
    expect(view.queryByTestId(`${prefix}-empty`)).toBeNull();
  });

  it('shows the empty state, not an error, when the server returns no rows', async () => {
    stubFetch(EMPTY_OK);
    const view = await renderWithProviders(<Screen />);

    await waitFor(() => expect(view.getByTestId(`${prefix}-empty`)).toBeTruthy());
    expect(view.queryByTestId(`${prefix}-error`)).toBeNull();
  });

  it('offers a retry that recovers once the server comes back', async () => {
    stubUnreachable();
    const view = await renderWithProviders(<Screen />);

    await waitFor(() => expect(view.getByTestId(`${prefix}-retry`)).toBeTruthy());

    stubFetch(EMPTY_OK);
    fireEvent.press(view.getByTestId(`${prefix}-retry`));

    await waitFor(() => expect(view.getByTestId(`${prefix}-empty`)).toBeTruthy());
    expect(view.queryByTestId(`${prefix}-error`)).toBeNull();
  });
});

describe('error message wording', () => {
  it('names the localhost problem when the build points at localhost', async () => {
    stubUnreachable();
    const view = await renderWithProviders(<InventoryScreen />);

    await waitFor(() => expect(view.getByTestId('inventory-error')).toBeTruthy());
    // Tests run with no EXPO_PUBLIC_API_URL, so the base URL is localhost —
    // exactly the case a phone cannot reach, and worth saying out loud.
    expect(view.getByTestId('inventory-error').props.children).toMatch(
      /localhost|reach the server/i
    );
  });

  it('distinguishes a rejected request from an unreachable one', async () => {
    stubServerError();
    const view = await renderWithProviders(<InventoryScreen />);

    await waitFor(() => expect(view.getByTestId('inventory-error')).toBeTruthy());
    expect(view.getByTestId('inventory-error').props.children).toMatch(/server had a problem/i);
  });
});

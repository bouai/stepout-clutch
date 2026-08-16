import AsyncStorage from '@react-native-async-storage/async-storage';

import App from '../../App';
import { render, stubFetch, waitFor } from '../test-utils';

const ONBOARDING_COMPLETE_KEY = 'stepout_onboarding_complete';

describe('App onboarding gate', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    stubFetch([
      { match: '/trips', body: [] },
      { match: '/weather', body: null, ok: false },
      { match: '/checklist-items', body: [] },
      { match: '/inventory-items', body: [] },
      { match: '/saved-destinations', body: [] },
      { match: '/geofence-events', body: [] },
      { match: '/geofence-triggers', body: [] },
    ]);
  });

  it('shows onboarding on a fresh install', async () => {
    const view = await render(<App />);

    await waitFor(() => expect(view.queryByTestId('app-loading')).toBeNull());
    expect(view.getByText(/StepOut/i)).toBeTruthy();
  });

  it('skips onboarding once it has been completed', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    const view = await render(<App />);

    await waitFor(() => expect(view.queryByTestId('app-loading')).toBeNull());
    // The tab bar only exists on the far side of the gate. "Home" matches both
    // the tab label and the screen heading, hence getAllByText.
    await waitFor(() => expect(view.getByText('Plan')).toBeTruthy());
    expect(view.getAllByText('Home').length).toBeGreaterThan(0);
    expect(view.getByText('Pack')).toBeTruthy();
    expect(view.getByText('Go')).toBeTruthy();
    expect(view.getByText('Track')).toBeTruthy();
  });

  it('treats a storage read failure as already onboarded rather than trapping the user', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage unavailable'));

    const view = await render(<App />);

    await waitFor(() => expect(view.queryByTestId('app-loading')).toBeNull());
    await waitFor(() => expect(view.getByText('Plan')).toBeTruthy());
  });
});

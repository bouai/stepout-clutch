// Exercises the real AuthContext + LoginScreen, opting out of the global mock.
jest.unmock('../../context/AuthContext');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';

import { AuthProvider, useAuth } from '../AuthContext';
import LoginScreen from '../../screens/LoginScreen';
import {
  fireEvent,
  renderWithSafeArea,
  stubFetch,
  waitFor,
} from '../../test-utils';

const SESSION_KEY = 'stepout_session_token';

/** Flush a pending render so a following press reads fresh state (React 19). */
const settle = () => waitFor(() => {});

function Probe() {
  const { user, ready } = useAuth();
  return (
    <>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="email">{user?.email ?? 'none'}</Text>
    </>
  );
}

function renderApp() {
  return renderWithSafeArea(
    <AuthProvider>
      <Probe />
      <LoginScreen />
    </AuthProvider>
  );
}

describe('AuthContext + LoginScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts signed out when there is no stored session', async () => {
    stubFetch([]);
    const view = await renderApp();

    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
    expect(view.getByTestId('email').props.children).toBe('none');
  });

  it('restores a stored session by validating it', async () => {
    await AsyncStorage.setItem(SESSION_KEY, 'stored-token');
    stubFetch([{ match: '/auth/me', body: { id: 1, email: 'me@example.com' } }]);
    const view = await renderApp();

    await waitFor(() =>
      expect(view.getByTestId('email').props.children).toBe('me@example.com')
    );
  });

  it('signs out if the stored session no longer validates', async () => {
    await AsyncStorage.setItem(SESSION_KEY, 'stale-token');
    stubFetch([{ match: '/auth/me', body: null, ok: false }]);
    const view = await renderApp();

    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
    expect(view.getByTestId('email').props.children).toBe('none');
  });

  it('completes the dev magic-link flow in two taps', async () => {
    stubFetch([
      { match: '/auth/request-link', body: { sent: false, emailEnabled: false, devToken: 'magic' }, method: 'POST' },
      { match: '/auth/verify', body: { sessionToken: 'sess', user: { id: 2, email: 'new@example.com' } }, method: 'POST' },
      { match: '/auth/me', body: { id: 2, email: 'new@example.com' } },
    ]);
    const view = await renderApp();
    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));

    fireEvent.changeText(view.getByTestId('login-email-input'), 'new@example.com');
    await settle();
    fireEvent.press(view.getByTestId('login-send-button'));

    await waitFor(() => expect(view.getByTestId('login-continue-button')).toBeTruthy());
    fireEvent.press(view.getByTestId('login-continue-button'));

    await waitFor(() =>
      expect(view.getByTestId('email').props.children).toBe('new@example.com')
    );
    expect(await AsyncStorage.getItem(SESSION_KEY)).toBe('sess');
  });

  it('surfaces a server error when the link cannot be requested', async () => {
    stubFetch([{ match: '/auth/request-link', body: null, ok: false, method: 'POST' }]);
    const view = await renderApp();
    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));

    fireEvent.changeText(view.getByTestId('login-email-input'), 'x@y.com');
    await settle();
    fireEvent.press(view.getByTestId('login-send-button'));

    await waitFor(() => expect(view.getByTestId('login-error')).toBeTruthy());
  });
});

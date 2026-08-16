import { Alert } from 'react-native';

import SettingsSheet from '../SettingsSheet';
import { fireEvent, renderWithSafeArea, stubFetch, waitFor } from '../../test-utils';

/** Taps the given button in the Alert.alert spy's most recent call. */
function pressAlertButton(label: string) {
  const spy = Alert.alert as unknown as jest.Mock;
  const buttons = spy.mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find((b: { text: string }) => b.text === label);
  expect(button).toBeDefined();
  return button.onPress?.();
}

describe('SettingsSheet', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (Alert.alert as unknown as jest.Mock).mockRestore?.();
  });

  it('shows which server the build points at', async () => {
    const view = await renderWithSafeArea(
      <SettingsSheet visible onClose={jest.fn()} onReset={jest.fn()} />
    );

    expect(view.getByTestId('settings-api-url')).toBeTruthy();
  });

  it('warns when the build points at localhost, which a phone cannot reach', async () => {
    const view = await renderWithSafeArea(
      <SettingsSheet visible onClose={jest.fn()} onReset={jest.fn()} />
    );

    // The test bundle has no EXPO_PUBLIC_API_URL, so it falls back to localhost.
    expect(view.getByTestId('settings-local-warning')).toBeTruthy();
  });

  it('asks for confirmation before deleting anything', async () => {
    stubFetch([{ match: '/admin/reset', body: { confirmed: true, deleted: {} } }]);
    const view = await renderWithSafeArea(
      <SettingsSheet visible onClose={jest.fn()} onReset={jest.fn()} />
    );

    fireEvent.press(view.getByTestId('settings-reset-button'));

    expect(Alert.alert).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when the confirmation is cancelled', async () => {
    stubFetch([{ match: '/admin/reset', body: { confirmed: true, deleted: {} } }]);
    const view = await renderWithSafeArea(
      <SettingsSheet visible onClose={jest.fn()} onReset={jest.fn()} />
    );

    fireEvent.press(view.getByTestId('settings-reset-button'));
    pressAlertButton('Cancel');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('wipes data and notifies the caller once confirmed', async () => {
    stubFetch([{ match: '/admin/reset', body: { confirmed: true, deleted: {} } }]);
    const onReset = jest.fn();
    const onClose = jest.fn();
    const view = await renderWithSafeArea(
      <SettingsSheet visible onClose={onClose} onReset={onReset} />
    );

    fireEvent.press(view.getByTestId('settings-reset-button'));
    await pressAlertButton('Delete everything');

    await waitFor(() => expect(onReset).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();

    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('/admin/reset');
    expect(url).toContain('confirm=true');
  });

  it('surfaces a failure instead of claiming the data was cleared', async () => {
    stubFetch([{ match: '/admin/reset', body: null, ok: false }]);
    const onReset = jest.fn();
    const view = await renderWithSafeArea(
      <SettingsSheet visible onClose={jest.fn()} onReset={onReset} />
    );

    fireEvent.press(view.getByTestId('settings-reset-button'));
    await pressAlertButton('Delete everything');

    await waitFor(() =>
      expect(view.getByTestId('settings-reset-error')).toBeTruthy()
    );
    expect(onReset).not.toHaveBeenCalled();
  });

  it('closes when done is pressed', async () => {
    const onClose = jest.fn();
    const view = await renderWithSafeArea(
      <SettingsSheet visible onClose={onClose} onReset={jest.fn()} />
    );

    fireEvent.press(view.getByTestId('settings-close-button'));

    expect(onClose).toHaveBeenCalled();
  });
});

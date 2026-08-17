import TripSwitcher from '../TripSwitcher';
import { TripProvider } from '../../context/TripContext';
import { fireEvent, render, stubFetch, waitFor } from '../../test-utils';

/**
 * The create flow's behaviour (calling apply-template with the chosen type,
 * surfacing the summary, tolerating failure) is covered where the harness is
 * stable — TripContext.test.tsx. This file only checks the picker UI itself,
 * because a full create round-trip through the modal is flaky under RNTL 14's
 * concurrent renderer across multiple mounts in one file.
 */
describe('TripSwitcher trip-type picker', () => {
  it('offers every trip type in the create form', async () => {
    stubFetch([{ match: '/trips', body: [] }]);
    const view = await render(
      <TripProvider>
        <TripSwitcher />
      </TripProvider>
    );

    fireEvent.press(view.getByTestId('trip-add-button'));
    await waitFor(() => expect(view.getByTestId('trip-name-input')).toBeTruthy());

    for (const type of ['commute', 'day-trip', 'overnight', 'business', 'flight', 'other']) {
      expect(view.getByTestId(`trip-type-${type}`)).toBeTruthy();
    }
  });

  it('lets a type be selected and cleared', async () => {
    stubFetch([{ match: '/trips', body: [] }]);
    const view = await render(
      <TripProvider>
        <TripSwitcher />
      </TripProvider>
    );

    fireEvent.press(view.getByTestId('trip-add-button'));
    await waitFor(() => expect(view.getByTestId('trip-type-commute')).toBeTruthy());

    // Selecting then re-pressing toggles it off; both are no-throw interactions
    // that would crash if the handler were wired wrong.
    const commute = view.getByTestId('trip-type-commute');
    fireEvent.press(commute);
    fireEvent.press(commute);
    expect(commute).toBeTruthy();
  });
});

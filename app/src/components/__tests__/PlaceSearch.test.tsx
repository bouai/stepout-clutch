import type { ComponentProps } from 'react';

import PlaceSearch from '../PlaceSearch';
import { fireEvent, renderWithSafeArea, stubFetch, waitFor } from '../../test-utils';

const INDIRANAGAR = {
  name: 'Indiranagar',
  context: 'Bengaluru, Karnataka, India',
  latitude: 12.9784,
  longitude: 77.6408,
};

const KORAMANGALA = {
  name: 'Koramangala',
  context: 'Bengaluru, Karnataka, India',
  latitude: 12.9352,
  longitude: 77.6245,
};

/**
 * The debounce is driven to zero rather than waited out.
 *
 * Fake timers cannot be used — RNTL 14's `render` is async and never resolves
 * against a frozen clock — and sitting through real 350ms waits made every
 * render after the third in this file come back as an empty tree. Injecting
 * the delay removes the dependency on wall-clock time entirely.
 */
function renderSearch(props: Partial<ComponentProps<typeof PlaceSearch>> = {}) {
  return renderWithSafeArea(
    <PlaceSearch onSelect={jest.fn()} debounceMs={0} {...props} />
  );
}

describe('PlaceSearch', () => {
  it('searches once the query is long enough', async () => {
    stubFetch([{ match: '/places', body: [INDIRANAGAR] }]);
    const view = await renderSearch();

    fireEvent.changeText(view.getByTestId('place-search-input'), 'indiranagar');

    await waitFor(() => expect(view.getByText('Indiranagar')).toBeTruthy());
    expect(view.getByText('Bengaluru, Karnataka, India')).toBeTruthy();
  });

  it('does not search a query below the minimum length', async () => {
    stubFetch([{ match: '/places', body: [] }]);
    const view = await renderSearch();

    fireEvent.changeText(view.getByTestId('place-search-input'), 'a');

    await waitFor(() => expect(view.queryByTestId('place-search-results')).toBeNull());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends the typed query upstream', async () => {
    stubFetch([{ match: '/places', body: [INDIRANAGAR] }]);
    const view = await renderSearch();

    fireEvent.changeText(view.getByTestId('place-search-input'), 'indiranagar');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      'q=indiranagar'
    );
  });

  it('reports the selected place to the caller', async () => {
    stubFetch([{ match: '/places', body: [INDIRANAGAR, KORAMANGALA] }]);
    const onSelect = jest.fn();
    const view = await renderSearch({ onSelect });

    fireEvent.changeText(view.getByTestId('place-search-input'), 'bengaluru');

    await waitFor(() => expect(view.getByTestId('place-search-result-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('place-search-result-1'));

    expect(onSelect).toHaveBeenCalledWith(KORAMANGALA);
  });

  it('clears the field and results after a selection', async () => {
    stubFetch([{ match: '/places', body: [INDIRANAGAR] }]);
    const view = await renderSearch();

    fireEvent.changeText(view.getByTestId('place-search-input'), 'indiranagar');
    await waitFor(() => expect(view.getByTestId('place-search-result-0')).toBeTruthy());

    fireEvent.press(view.getByTestId('place-search-result-0'));

    await waitFor(() => expect(view.queryByTestId('place-search-results')).toBeNull());
    expect(view.getByTestId('place-search-input').props.value).toBe('');
  });

  it('biases results toward the supplied position', async () => {
    stubFetch([{ match: '/places', body: [INDIRANAGAR] }]);
    const view = await renderSearch({ near: { latitude: 12.97, longitude: 77.59 } });

    fireEvent.changeText(view.getByTestId('place-search-input'), 'airport');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('lat=12.97');
    expect(url).toContain('lon=77.59');
  });

  it('omits location bias when no position is known', async () => {
    stubFetch([{ match: '/places', body: [INDIRANAGAR] }]);
    const view = await renderSearch({ near: null });

    fireEvent.changeText(view.getByTestId('place-search-input'), 'airport');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).not.toContain('lat=');
  });

  it('distinguishes no matches from a failed search', async () => {
    stubFetch([{ match: '/places', body: [] }]);
    const view = await renderSearch();

    fireEvent.changeText(view.getByTestId('place-search-input'), 'zzzzzz');

    await waitFor(() => expect(view.getByTestId('place-search-empty')).toBeTruthy());
    expect(view.queryByTestId('place-search-error')).toBeNull();
  });

  it('surfaces a search failure', async () => {
    stubFetch([{ match: '/places', body: null, ok: false }]);
    const view = await renderSearch();

    fireEvent.changeText(view.getByTestId('place-search-input'), 'indiranagar');

    await waitFor(() => expect(view.getByTestId('place-search-error')).toBeTruthy());
    expect(view.queryByTestId('place-search-empty')).toBeNull();
  });

  it('clears results when the query is emptied', async () => {
    stubFetch([{ match: '/places', body: [INDIRANAGAR] }]);
    const view = await renderSearch();
    const input = view.getByTestId('place-search-input');

    fireEvent.changeText(input, 'indiranagar');
    await waitFor(() => expect(view.getByTestId('place-search-results')).toBeTruthy());

    fireEvent.changeText(input, '');

    await waitFor(() => expect(view.queryByTestId('place-search-results')).toBeNull());
  });
});

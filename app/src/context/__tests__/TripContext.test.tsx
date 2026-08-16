import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, Text } from 'react-native';

import { TripProvider, useTripContext } from '../TripContext';
import { fireEvent, render, stubFetch, waitFor } from '../../test-utils';

const SELECTED_TRIP_KEY = 'stepout_selected_trip_id';

const TOKYO = { id: 1, name: 'Tokyo', latitude: null, longitude: null, createdAt: 'x' };
const LISBON = { id: 2, name: 'Lisbon', latitude: null, longitude: null, createdAt: 'x' };

/** Surfaces context state as text, and exposes actions as pressables. */
function Probe() {
  const { trips, currentTripId, ready, selectTrip, renameTrip, deleteTrip } =
    useTripContext();

  return (
    <>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="current">{String(currentTripId)}</Text>
      <Text testID="names">{trips.map((t) => t.name).join(',')}</Text>
      <Pressable testID="select-1" onPress={() => selectTrip(1)}>
        <Text>select 1</Text>
      </Pressable>
      <Pressable testID="select-all" onPress={() => selectTrip(null)}>
        <Text>select all</Text>
      </Pressable>
      <Pressable testID="rename-1" onPress={() => renameTrip(1, 'Kyoto')}>
        <Text>rename</Text>
      </Pressable>
      <Pressable testID="delete-1" onPress={() => deleteTrip(1)}>
        <Text>delete</Text>
      </Pressable>
    </>
  );
}

function renderProbe() {
  return render(
    <TripProvider>
      <Probe />
    </TripProvider>
  );
}

describe('TripContext', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads trips from the API', async () => {
    stubFetch([{ match: '/trips', body: [TOKYO, LISBON] }]);
    const view = await renderProbe();

    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Tokyo,Lisbon')
    );
  });

  it('falls back to an empty list when the API is unreachable', async () => {
    stubFetch([{ match: '/trips', body: null, ok: false }]);
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
    expect(view.getByTestId('names').props.children).toBe('');
  });

  it('persists the selected trip so it survives a restart', async () => {
    stubFetch([{ match: '/trips', body: [TOKYO, LISBON] }]);
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
    fireEvent.press(view.getByTestId('select-1'));

    await waitFor(() => expect(view.getByTestId('current').props.children).toBe('1'));
    expect(await AsyncStorage.getItem(SELECTED_TRIP_KEY)).toBe('1');
  });

  it('clears the persisted selection when switching back to All', async () => {
    await AsyncStorage.setItem(SELECTED_TRIP_KEY, '1');
    stubFetch([{ match: '/trips', body: [TOKYO, LISBON] }]);
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('current').props.children).toBe('1'));
    fireEvent.press(view.getByTestId('select-all'));

    await waitFor(() => expect(view.getByTestId('current').props.children).toBe('null'));
    expect(await AsyncStorage.getItem(SELECTED_TRIP_KEY)).toBeNull();
  });

  it('renames a trip in place', async () => {
    stubFetch([
      { match: '/trips/1', body: { ...TOKYO, name: 'Kyoto' } },
      { match: '/trips', body: [TOKYO, LISBON] },
    ]);
    const view = await renderProbe();

    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Tokyo,Lisbon')
    );
    fireEvent.press(view.getByTestId('rename-1'));

    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Kyoto,Lisbon')
    );
  });

  it('deletes a trip and falls back to All when it was selected', async () => {
    await AsyncStorage.setItem(SELECTED_TRIP_KEY, '1');
    stubFetch([
      { match: '/trips/1', body: null },
      { match: '/trips', body: [TOKYO, LISBON] },
    ]);
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('current').props.children).toBe('1'));
    fireEvent.press(view.getByTestId('delete-1'));

    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Lisbon')
    );
    expect(view.getByTestId('current').props.children).toBe('null');
  });

  it('restores a persisted selection on mount', async () => {
    await AsyncStorage.setItem(SELECTED_TRIP_KEY, '2');
    stubFetch([{ match: '/trips', body: [TOKYO, LISBON] }]);
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('current').props.children).toBe('2'));
  });

  it('discards a persisted selection pointing at a deleted trip', async () => {
    await AsyncStorage.setItem(SELECTED_TRIP_KEY, '99');
    stubFetch([{ match: '/trips', body: [TOKYO, LISBON] }]);
    const view = await renderProbe();

    // Without this reset, every screen filters on a dead id and shows nothing.
    await waitFor(() => expect(view.getByTestId('current').props.children).toBe('null'));
  });

  it('ignores a corrupt persisted value', async () => {
    await AsyncStorage.setItem(SELECTED_TRIP_KEY, 'not-a-number');
    stubFetch([{ match: '/trips', body: [TOKYO] }]);
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
    expect(view.getByTestId('current').props.children).toBe('null');
  });
});

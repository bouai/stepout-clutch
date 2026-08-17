import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { TripProvider, useTripContext } from '../TripContext';
import { fireEvent, render, stubFetch, waitFor } from '../../test-utils';

const SELECTED_TRIP_KEY = 'stepout_selected_trip_id';

const TOKYO = { id: 1, name: 'Tokyo', latitude: null, longitude: null, createdAt: 'x' };
const LISBON = { id: 2, name: 'Lisbon', latitude: null, longitude: null, createdAt: 'x' };

/** Surfaces context state as text, and exposes actions as pressables. */
function Probe() {
  const {
    trips,
    currentTripId,
    ready,
    selectTrip,
    createTrip,
    renameTrip,
    deleteTrip,
    maybeResetChecklist,
  } = useTripContext();
  const [applied, setApplied] = useState('none');
  const [resetResult, setResetResult] = useState('none');

  return (
    <>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="current">{String(currentTripId)}</Text>
      <Text testID="names">{trips.map((t) => t.name).join(',')}</Text>
      <Text testID="applied">{applied}</Text>
      <Text testID="reset-result">{resetResult}</Text>
      <Pressable
        testID="maybe-reset-1"
        onPress={async () => {
          const did = await maybeResetChecklist(1);
          setResetResult(did ? 'reset' : 'skipped');
        }}
      >
        <Text>maybe reset</Text>
      </Pressable>
      <Pressable testID="select-1" onPress={() => selectTrip(1)}>
        <Text>select 1</Text>
      </Pressable>
      <Pressable testID="select-all" onPress={() => selectTrip(null)}>
        <Text>select all</Text>
      </Pressable>
      <Pressable
        testID="create-typed"
        onPress={async () => {
          const result = await createTrip('Infosys Noida', { tripType: 'commute' });
          setApplied(
            result?.applied ? `added:${result.applied.checklistAdded}` : 'no-apply'
          );
        }}
      >
        <Text>create typed</Text>
      </Pressable>
      <Pressable
        testID="create-untyped"
        onPress={async () => {
          const result = await createTrip('Quick trip');
          setApplied(result?.applied ? 'unexpected-apply' : 'no-apply');
        }}
      >
        <Text>create untyped</Text>
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

  const NEW_TYPED = {
    id: 9,
    name: 'Infosys Noida',
    latitude: null,
    longitude: null,
    tripType: 'commute',
    templateApplied: false,
    createdAt: 'x',
  };
  const APPLIED = {
    checklistAdded: 3,
    inventoryAdded: 5,
    zonesAdded: 0,
    weatherCondition: 'clear',
  };

  it('applies the template when a trip is created with a type', async () => {
    stubFetch([
      { match: '/trips/9/apply-template', body: APPLIED, method: 'POST' },
      { match: '/trips', body: NEW_TYPED, method: 'POST' },
      { match: '/trips', body: [], method: 'GET' },
    ]);
    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));

    fireEvent.press(view.getByTestId('create-typed'));

    await waitFor(() =>
      expect(view.getByTestId('applied').props.children).toBe('added:3')
    );
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('/trips/9/apply-template'))).toBe(true);
  });

  it('does not apply a template when a trip is created without a type', async () => {
    stubFetch([
      { match: '/trips/9/apply-template', body: APPLIED, method: 'POST' },
      { match: '/trips', body: { ...NEW_TYPED, tripType: null }, method: 'POST' },
      { match: '/trips', body: [], method: 'GET' },
    ]);
    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));

    fireEvent.press(view.getByTestId('create-untyped'));

    await waitFor(() =>
      expect(view.getByTestId('applied').props.children).toBe('no-apply')
    );
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('apply-template'))).toBe(false);
  });

  it('still creates the trip when applying the template fails', async () => {
    stubFetch([
      { match: '/trips/9/apply-template', body: null, ok: false, method: 'POST' },
      { match: '/trips', body: NEW_TYPED, method: 'POST' },
      { match: '/trips', body: [], method: 'GET' },
    ]);
    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));

    fireEvent.press(view.getByTestId('create-typed'));

    // The trip lands in the list even though the template did not apply.
    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Infosys Noida')
    );
    expect(view.getByTestId('applied').props.children).toBe('no-apply');
  });

  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(
      n.getDate()
    ).padStart(2, '0')}`;
  })();

  const RECURRING = {
    id: 1,
    name: 'Commute',
    latitude: null,
    longitude: null,
    tripType: 'commute',
    templateApplied: true,
    isRecurring: true,
    checklistResetOn: '2000-01-01',
    createdAt: 'x',
  };

  it('resets a recurring trip whose checklist is stale', async () => {
    stubFetch([
      { match: '/trips/1/reset-checklist', body: { resetCount: 2, checklistResetOn: today }, method: 'POST' },
      { match: '/trips', body: [RECURRING], method: 'GET' },
    ]);
    const view = await renderProbe();
    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Commute')
    );

    fireEvent.press(view.getByTestId('maybe-reset-1'));

    await waitFor(() =>
      expect(view.getByTestId('reset-result').props.children).toBe('reset')
    );
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes(`/trips/1/reset-checklist`) && u.includes(today))).toBe(
      true
    );
  });

  it('does not reset again once already reset today', async () => {
    stubFetch([
      { match: '/trips/1/reset-checklist', body: { resetCount: 0, checklistResetOn: today }, method: 'POST' },
      { match: '/trips', body: [{ ...RECURRING, checklistResetOn: today }], method: 'GET' },
    ]);
    const view = await renderProbe();
    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Commute')
    );

    fireEvent.press(view.getByTestId('maybe-reset-1'));

    await waitFor(() =>
      expect(view.getByTestId('reset-result').props.children).toBe('skipped')
    );
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('reset-checklist'))).toBe(false);
  });

  it('does not reset a non-recurring trip', async () => {
    stubFetch([
      { match: '/trips/1/reset-checklist', body: {}, method: 'POST' },
      { match: '/trips', body: [{ ...RECURRING, isRecurring: false }], method: 'GET' },
    ]);
    const view = await renderProbe();
    await waitFor(() =>
      expect(view.getByTestId('names').props.children).toBe('Commute')
    );

    fireEvent.press(view.getByTestId('maybe-reset-1'));

    await waitFor(() =>
      expect(view.getByTestId('reset-result').props.children).toBe('skipped')
    );
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('reset-checklist'))).toBe(false);
  });
});

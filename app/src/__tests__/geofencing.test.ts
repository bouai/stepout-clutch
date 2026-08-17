import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  GEOFENCE_TASK,
  enrichExitBody,
  startGeofencing,
  stopGeofencing,
} from '../geofencing';
import type { GeofenceTrigger } from '../types/models';

function trigger(overrides: Partial<GeofenceTrigger> = {}): GeofenceTrigger {
  return {
    id: 1,
    label: 'Shinjuku Ward',
    latitude: 35.6938,
    longitude: 139.7034,
    radiusMeters: 800,
    triggerType: 'enter',
    notificationMessage: "You've arrived in Shinjuku",
    isActive: true,
    tripId: null,
    ...overrides,
  } as GeofenceTrigger;
}

/** Invokes the registered task the way the OS would on a real transition. */
async function fireGeofenceEvent(eventType: number, identifier: string) {
  const handler = (TaskManager as unknown as {
    __getTask: (name: string) => (payload: unknown) => Promise<void>;
  }).__getTask(GEOFENCE_TASK);
  expect(handler).toBeDefined();
  await handler({ data: { eventType, region: { identifier } }, error: null });
}

describe('startGeofencing', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('registers one region per active trigger', async () => {
    const result = await startGeofencing([
      trigger({ id: 1 }),
      trigger({ id: 2, label: 'Hotel', triggerType: 'exit' }),
    ]);

    expect(result).toEqual({ ok: true, regionCount: 2 });
    expect(Location.startGeofencingAsync).toHaveBeenCalledWith(
      GEOFENCE_TASK,
      expect.arrayContaining([
        expect.objectContaining({ identifier: '1', radius: 800, notifyOnEnter: true, notifyOnExit: false }),
        expect.objectContaining({ identifier: '2', notifyOnEnter: false, notifyOnExit: true }),
      ])
    );
  });

  it('excludes inactive triggers', async () => {
    const result = await startGeofencing([
      trigger({ id: 1 }),
      trigger({ id: 2, isActive: false }),
    ]);

    expect(result).toEqual({ ok: true, regionCount: 1 });
    const regions = (Location.startGeofencingAsync as jest.Mock).mock.calls[0][1];
    expect(regions.map((r: { identifier: string }) => r.identifier)).toEqual(['1']);
  });

  it('stops geofencing rather than registering an empty region set', async () => {
    (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValueOnce(true);

    const result = await startGeofencing([trigger({ isActive: false })]);

    expect(result).toEqual({ ok: false, reason: 'no-regions' });
    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(Location.stopGeofencingAsync).toHaveBeenCalledWith(GEOFENCE_TASK);
  });

  it('reports missing background permission distinctly from missing foreground', async () => {
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    expect(await startGeofencing([trigger()])).toEqual({
      ok: false,
      reason: 'no-background-permission',
    });

    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    expect(await startGeofencing([trigger()])).toEqual({
      ok: false,
      reason: 'no-foreground-permission',
    });
  });

  it('does not ask for background permission before foreground is granted', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    await startGeofencing([trigger()]);

    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('surfaces a registration failure rather than reporting success', async () => {
    (Location.startGeofencingAsync as jest.Mock).mockRejectedValueOnce(
      new Error('too many regions')
    );

    expect(await startGeofencing([trigger()])).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('the background task', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
  });

  /**
   * Android reports the state it finds the moment a region is registered, so
   * the first event for a region is always a baseline. Real crossings in these
   * tests are therefore preceded by the opposite state.
   */
  async function establishBaseline(identifier: string, state: 'inside' | 'outside') {
    await fireGeofenceEvent(
      state === 'inside'
        ? Location.LocationGeofencingEventType.Enter
        : Location.LocationGeofencingEventType.Exit,
      identifier
    );
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockClear();
  }

  it('notifies with the trigger label and message on enter', async () => {
    await startGeofencing([trigger()]);
    await establishBaseline('1', 'outside');

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Enter, '1');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: {
          title: 'Shinjuku Ward',
          body: "You've arrived in Shinjuku",
        },
        trigger: null,
      })
    );
  });

  it('logs the event with the direction the OS reported', async () => {
    await startGeofencing([trigger({ id: 7, triggerType: 'exit' })]);
    await establishBaseline('7', 'inside');

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '7');

    const [, options] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(JSON.parse(options.body)).toEqual({ triggerId: 7, direction: 'exit' });
  });

  it('stays silent on the state reported at registration', async () => {
    // Registering four Tokyo zones from India fired all four instantly, because
    // Android evaluates every region on registration and reports the result as
    // a transition.
    await startGeofencing([
      trigger({ id: 1 }),
      trigger({ id: 2, label: 'Hotel', triggerType: 'exit' }),
      trigger({ id: 3, label: 'Haneda Airport' }),
    ]);

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '1');
    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '2');
    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '3');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('stays silent when the same state is reported twice', async () => {
    await startGeofencing([trigger()]);
    await establishBaseline('1', 'outside');

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('ignores a crossing whose direction the trigger does not watch', async () => {
    // An exit on an enter-type trigger previously notified anyway, using the
    // enter-worded message — which is how "You've arrived in Shinjuku" appeared
    // for a zone that had never been entered.
    await startGeofencing([trigger({ id: 1, triggerType: 'enter' })]);
    await establishBaseline('1', 'inside');

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('notifies on a genuine crossing after the baseline settles', async () => {
    await startGeofencing([trigger({ id: 2, label: 'Hotel', triggerType: 'exit', notificationMessage: 'Heading out' })]);
    await establishBaseline('2', 'inside');

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '2');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { title: 'Hotel', body: 'Heading out' },
        trigger: null,
      })
    );
  });

  it('forgets state for regions that are no longer registered', async () => {
    await startGeofencing([trigger({ id: 1 }), trigger({ id: 2, label: 'Hotel' })]);
    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '2');

    // Trigger 2 is deleted; a new trigger reusing the id must not inherit its
    // baseline and skip the user's first real alert.
    await startGeofencing([trigger({ id: 1 })]);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();

    await startGeofencing([trigger({ id: 1 }), trigger({ id: 2, label: 'Cafe' })]);
    await fireGeofenceEvent(Location.LocationGeofencingEventType.Exit, '2');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('still notifies when the cache has no entry for the region', async () => {
    // The process can be relaunched cold with an empty cache; a generic alert
    // beats no alert at all.
    await establishBaseline('42', 'outside');

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Enter, '42');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { title: 'StepOut', body: 'You have arrived.' },
        trigger: null,
      })
    );
  });

  it('still notifies when event logging fails', async () => {
    await startGeofencing([trigger()]);
    await establishBaseline('1', 'outside');
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await fireGeofenceEvent(Location.LocationGeofencingEventType.Enter, '1');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('ignores a payload with an error or no region', async () => {
    const handler = (TaskManager as unknown as {
      __getTask: (name: string) => (payload: unknown) => Promise<void>;
    }).__getTask(GEOFENCE_TASK);

    await handler({ data: null, error: new Error('boom') });
    await handler({ data: {}, error: null });

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('stopGeofencing', () => {
  it('is a no-op when nothing is registered', async () => {
    (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValueOnce(false);
    await stopGeofencing();
    expect(Location.stopGeofencingAsync).not.toHaveBeenCalled();
  });

  it('unregisters when a task is active', async () => {
    (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValueOnce(true);
    await stopGeofencing();
    expect(Location.stopGeofencingAsync).toHaveBeenCalledWith(GEOFENCE_TASK);
  });
});

describe('enrichExitBody (did-you-pack-everything?)', () => {
  const INV = (over = {}) => ({
    ok: true,
    status: 200,
    json: async () => [
      { name: 'Laptop', isPacked: true },
      { name: 'Charger', isPacked: false },
      { name: 'Badge', isPacked: false },
    ],
    ...over,
  });

  it('appends unpacked items on a departure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(INV());
    const body = await enrichExitBody('Heading home — got everything?', 'exit', 7);
    expect(body).toContain('Still to pack: Charger, Badge');
  });

  it('leaves the body untouched on an arrival', async () => {
    const body = await enrichExitBody('Arrived', 'enter', 7);
    expect(body).toBe('Arrived');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('leaves the body untouched when the trigger has no trip', async () => {
    const body = await enrichExitBody('Leaving', 'exit', null);
    expect(body).toBe('Leaving');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says nothing extra when everything is packed', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ name: 'Laptop', isPacked: true }],
    });
    const body = await enrichExitBody('Leaving', 'exit', 7);
    expect(body).toBe('Leaving');
  });

  it('caps the list and counts the overflow', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { name: 'A', isPacked: false },
        { name: 'B', isPacked: false },
        { name: 'C', isPacked: false },
        { name: 'D', isPacked: false },
        { name: 'E', isPacked: false },
      ],
    });
    const body = await enrichExitBody('Leaving', 'exit', 7);
    expect(body).toContain('A, B, C +2 more');
  });

  it('falls back to the base body when the lookup fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    const body = await enrichExitBody('Leaving', 'exit', 7);
    expect(body).toBe('Leaving');
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { apiRequest } from './api';
import type { GeofenceTrigger } from './types/models';

export const GEOFENCE_TASK = 'stepout-geofence-task';

/**
 * Trigger metadata cached for the background task.
 *
 * The task runs outside React — there is no context, no provider, and often no
 * mounted component at all — so anything it needs to build a notification has
 * to be on disk before the event fires.
 */
const TRIGGER_CACHE_KEY = 'stepout_geofence_trigger_cache';

type CachedTrigger = Pick<
  GeofenceTrigger,
  'id' | 'label' | 'notificationMessage' | 'triggerType'
>;

async function readTriggerCache(): Promise<Record<string, CachedTrigger>> {
  try {
    const raw = await AsyncStorage.getItem(TRIGGER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CachedTrigger>) : {};
  } catch {
    return {};
  }
}

async function writeTriggerCache(triggers: GeofenceTrigger[]): Promise<void> {
  const cache: Record<string, CachedTrigger> = {};
  for (const trigger of triggers) {
    cache[String(trigger.id)] = {
      id: trigger.id,
      label: trigger.label,
      notificationMessage: trigger.notificationMessage,
      triggerType: trigger.triggerType,
    };
  }
  try {
    await AsyncStorage.setItem(TRIGGER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A cache miss degrades the notification text, not the alert itself.
  }
}

/**
 * Registered at module scope so the OS can find it on a cold start — the app
 * process may be relaunched purely to deliver a geofence event, with no UI.
 */
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;

  const { eventType, region } = (data ?? {}) as {
    eventType?: Location.LocationGeofencingEventType;
    region?: Location.LocationRegion;
  };
  if (eventType === undefined || !region?.identifier) return;

  const direction =
    eventType === Location.LocationGeofencingEventType.Enter ? 'enter' : 'exit';

  const cache = await readTriggerCache();
  const trigger = cache[region.identifier];
  const triggerId = Number(region.identifier);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: trigger?.label ?? 'StepOut',
      body:
        trigger?.notificationMessage ??
        (direction === 'enter' ? 'You have arrived.' : 'You have left the area.'),
    },
    trigger: null,
  });

  if (Number.isInteger(triggerId)) {
    try {
      await apiRequest('/geofence-events', {
        method: 'POST',
        body: { triggerId, direction },
      });
    } catch {
      // Logging is best-effort; never let it suppress the notification the
      // user actually cares about.
    }
  }
});

/** Whether the OS is currently watching this app's regions. */
export async function isGeofencingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  } catch {
    return false;
  }
}

export type GeofencingStartResult =
  | { ok: true; regionCount: number }
  | { ok: false; reason: 'no-foreground-permission' | 'no-background-permission' | 'no-regions' | 'failed' };

/**
 * Hands the active triggers to the OS.
 *
 * Replaces a foreground `watchPositionAsync` loop that evaluated haversine
 * distance in JS — which meant alerts only fired while the app was open on the
 * tracking tab, contradicting what onboarding promises. OS geofencing survives
 * backgrounding and app termination, and costs far less battery.
 */
export async function startGeofencing(
  triggers: GeofenceTrigger[]
): Promise<GeofencingStartResult> {
  const active = triggers.filter((trigger) => trigger.isActive);
  await writeTriggerCache(active);

  if (active.length === 0) {
    await stopGeofencing();
    return { ok: false, reason: 'no-regions' };
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { ok: false, reason: 'no-foreground-permission' };
  }

  // Android requires foreground to be granted first, and shows background as a
  // separate, more consequential prompt.
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    return { ok: false, reason: 'no-background-permission' };
  }

  const regions: Location.LocationRegion[] = active.map((trigger) => ({
    identifier: String(trigger.id),
    latitude: trigger.latitude,
    longitude: trigger.longitude,
    radius: trigger.radiusMeters,
    // Let the OS filter by direction so the task is never woken pointlessly.
    notifyOnEnter: trigger.triggerType === 'enter',
    notifyOnExit: trigger.triggerType === 'exit',
  }));

  try {
    // startGeofencingAsync replaces the full region set, so this is also how
    // triggers get removed — no separate teardown per trigger.
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    return { ok: true, regionCount: regions.length };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function stopGeofencing(): Promise<void> {
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  } catch {
    // Nothing registered, or the task was already torn down.
  }
}

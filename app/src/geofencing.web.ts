/**
 * Web stub for the geofencing module.
 *
 * Background geofencing is an OS capability with no browser equivalent —
 * `expo-task-manager` is native-only and would break the web bundle. The web
 * build exists for testing the rest of the app, so this reports geofencing as
 * simply unavailable rather than pretending to arm it.
 */

import type { GeofenceTrigger } from './types/models';

export const GEOFENCE_TASK = 'stepout-geofence-task';

export type GeofencingStartResult =
  | { ok: true; regionCount: number }
  | {
      ok: false;
      reason:
        | 'no-foreground-permission'
        | 'no-background-permission'
        | 'no-regions'
        | 'unsupported'
        | 'failed';
    };

export async function startGeofencing(
  _triggers: GeofenceTrigger[]
): Promise<GeofencingStartResult> {
  return { ok: false, reason: 'unsupported' };
}

export async function stopGeofencing(): Promise<void> {}

export async function isGeofencingActive(): Promise<boolean> {
  return false;
}

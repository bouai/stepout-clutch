/** Geometry and types shared by the native and web MapCanvas implementations. */

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

/** MapLibre orders coordinates [longitude, latitude], the reverse of the API. */
export type LngLatTuple = [number, number];

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export function toLngLat({ latitude, longitude }: Coordinate): LngLatTuple {
  return [longitude, latitude];
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Approximates a circle as a GeoJSON polygon.
 *
 * MapLibre has no circle-with-a-metre-radius primitive — its `circle` layer is
 * sized in screen pixels, which would keep a geofence the same size on screen
 * no matter the zoom. A polygon is the only way to draw a radius that stays
 * correct against the ground.
 */
export function circlePolygon(
  center: Coordinate,
  radiusMeters: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const latRadians = (center.latitude * Math.PI) / 180;
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lonDelta = latDelta / Math.max(Math.cos(latRadians), 1e-6);

  const ring: LngLatTuple[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      center.longitude + lonDelta * Math.cos(angle),
      center.latitude + latDelta * Math.sin(angle),
    ]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

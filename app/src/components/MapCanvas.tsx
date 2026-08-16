import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

/**
 * OpenFreeMap serves MapLibre vector tiles with no API key, no billing account
 * and no usage quota. It replaces Google Maps, whose Android SDK requires a
 * billing-backed key — the evaluation key previously committed here had
 * expired, which is why both map screens rendered black.
 */
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

interface MapCanvasProps {
  /** Recentres the camera when this changes. */
  center: Coordinate;
  zoom?: number;
  /** Draws the OS-provided location dot. */
  showUserLocation?: boolean;
  onPress?: (coordinate: Coordinate) => void;
  children?: ReactNode;
  testID?: string;
}

export default function MapCanvas({
  center,
  zoom = 12,
  showUserLocation = true,
  onPress,
  children,
  testID = 'map-canvas',
}: MapCanvasProps) {
  const cameraRef = useRef<CameraRef>(null);
  // Recentring on every render would fight the user's own panning, so the
  // camera only moves when the requested centre actually changes.
  const lastCenter = useRef<string>('');

  useEffect(() => {
    const key = `${center.latitude},${center.longitude}`;
    if (key === lastCenter.current) return;
    lastCenter.current = key;
    cameraRef.current?.easeTo({ center: toLngLat(center), duration: 500 });
  }, [center]);

  return (
    <Map
      style={styles.map}
      mapStyle={MAP_STYLE_URL}
      testID={testID}
      onPress={(event) => {
        const { lngLat } = event.nativeEvent;
        if (!lngLat) return;
        const [longitude, latitude] = lngLat as unknown as LngLatTuple;
        onPress?.({ latitude, longitude });
      }}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: toLngLat(center), zoom }}
      />
      {showUserLocation && <UserLocation animated />}
      {children}
    </Map>
  );
}

/** A filled radius ring, used for geofence zones. */
export function MapCircle({
  id,
  center,
  radiusMeters,
  active = true,
}: {
  id: string;
  center: Coordinate;
  radiusMeters: number;
  active?: boolean;
}) {
  return (
    <GeoJSONSource id={`circle-${id}`} data={circlePolygon(center, radiusMeters)}>
      <Layer
        type="fill"
        id={`circle-fill-${id}`}
        paint={{
          'fill-color': active ? colors.accent : colors.textSecondary,
          'fill-opacity': active ? 0.2 : 0.1,
        }}
      />
      <Layer
        type="line"
        id={`circle-line-${id}`}
        paint={{
          'line-color': active ? colors.accent : colors.textSecondary,
          'line-width': 2,
          'line-opacity': active ? 0.85 : 0.4,
        }}
      />
    </GeoJSONSource>
  );
}

/** A labelled pin. MapLibre markers render arbitrary children, not pin images. */
export function MapPin({
  id,
  coordinate,
  glyph = '📍',
  tone = 'accent',
  onPress,
  testID,
}: {
  id: string;
  coordinate: Coordinate;
  glyph?: string;
  tone?: 'accent' | 'muted';
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Marker id={id} lngLat={toLngLat(coordinate)} onPress={onPress}>
      <View
        style={[styles.pin, tone === 'muted' && styles.pinMuted]}
        testID={testID}
      >
        <Text style={styles.pinGlyph}>{glyph}</Text>
      </View>
    </Marker>
  );
}

/** Straight-line route between two points. */
export function MapLine({
  id,
  from,
  to,
}: {
  id: string;
  from: Coordinate;
  to: Coordinate;
}) {
  return (
    <GeoJSONSource
      id={`line-${id}`}
      data={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [toLngLat(from), toLngLat(to)] },
      }}
    >
      <Layer
        type="line"
        id={`line-stroke-${id}`}
        paint={{ 'line-color': colors.accent, 'line-width': 3, 'line-opacity': 0.8 }}
      />
    </GeoJSONSource>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  pin: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textOnGradient,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pinMuted: {
    backgroundColor: colors.textSecondary,
  },
  pinGlyph: {
    fontSize: 14,
  },
});

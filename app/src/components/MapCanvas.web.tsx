import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MAP_STYLE_URL,
  circlePolygon,
  toLngLat,
  type Coordinate,
} from './map-shared';
import { colors } from '../theme';

export {
  MAP_STYLE_URL,
  circlePolygon,
  toLngLat,
  type Coordinate,
  type LngLatTuple,
} from './map-shared';

/**
 * Web MapCanvas, backed by maplibre-gl (the browser library).
 *
 * `@maplibre/maplibre-react-native` is native-only, so this platform sibling
 * exists purely so the app runs in a browser for local testing — the phone
 * still uses the native `MapCanvas.tsx`. It exposes the same component API, so
 * the screens are unaware of which one they get.
 *
 * The child components (MapCircle/MapPin/MapLine) register their geometry
 * through context rather than rendering DOM, so a running map instance can
 * pick them up imperatively.
 */

interface MapRegistry {
  setCircle: (id: string, feature: GeoJSON.Feature | null, active: boolean) => void;
  setLine: (id: string, feature: GeoJSON.Feature | null) => void;
  setMarker: (
    id: string,
    coordinate: Coordinate | null,
    glyph: string,
    onPress?: () => void
  ) => void;
}

const MapContext = createContext<MapRegistry | null>(null);

interface MapCanvasProps {
  center: Coordinate;
  zoom?: number;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const [ready, setReady] = useState(false);
  const [registry, setRegistry] = useState<MapRegistry | null>(null);

  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: toLngLat(center),
      zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('click', (event) => {
      onPressRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });

    map.on('load', () => {
      setReady(true);
      setRegistry({
        setCircle(id, feature, active) {
          const sourceId = `circle-${id}`;
          upsertGeoJson(map, sourceId, feature);
          if (feature) {
            ensureLayer(map, `${sourceId}-fill`, sourceId, 'fill', {
              'fill-color': active ? colors.accent : colors.textSecondary,
              'fill-opacity': active ? 0.2 : 0.1,
            });
            ensureLayer(map, `${sourceId}-line`, sourceId, 'line', {
              'line-color': active ? colors.accent : colors.textSecondary,
              'line-width': 2,
            });
          }
        },
        setLine(id, feature) {
          const sourceId = `line-${id}`;
          upsertGeoJson(map, sourceId, feature);
          if (feature) {
            ensureLayer(map, `${sourceId}-stroke`, sourceId, 'line', {
              'line-color': colors.accent,
              'line-width': 3,
            });
          }
        },
        setMarker(id, coordinate, glyph, onPressMarker) {
          const existing = markersRef.current[id];
          if (!coordinate) {
            existing?.remove();
            delete markersRef.current[id];
            return;
          }
          if (existing) {
            existing.setLngLat(toLngLat(coordinate));
            return;
          }
          const el = document.createElement('div');
          el.textContent = glyph;
          el.style.cssText =
            'font-size:18px;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))';
          if (onPressMarker) el.addEventListener('click', onPressMarker);
          markersRef.current[id] = new maplibregl.Marker({ element: el })
            .setLngLat(toLngLat(coordinate))
            .addTo(map);
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Intentionally run once; camera moves are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) mapRef.current?.easeTo({ center: toLngLat(center), duration: 500 });
  }, [center, ready]);

  return (
    <View style={styles.container} testID={testID}>
      {/* react-native-web renders View as a div; the map mounts into this node. */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {showUserLocation && null}
      {registry && (
        <MapContext.Provider value={registry}>{children}</MapContext.Provider>
      )}
    </View>
  );
}

function upsertGeoJson(
  map: maplibregl.Map,
  sourceId: string,
  feature: GeoJSON.Feature | null
) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (feature) {
    if (source) source.setData(feature);
    else map.addSource(sourceId, { type: 'geojson', data: feature });
  }
}

function ensureLayer(
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
  type: 'fill' | 'line',
  paint: Record<string, unknown>
) {
  if (map.getLayer(layerId)) {
    for (const [key, value] of Object.entries(paint)) {
      map.setPaintProperty(layerId, key, value as never);
    }
    return;
  }
  map.addLayer({ id: layerId, type, source: sourceId, paint } as never);
}

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
  const registry = useContext(MapContext);
  useEffect(() => {
    registry?.setCircle(id, circlePolygon(center, radiusMeters), active);
    return () => registry?.setCircle(id, null, active);
  }, [registry, id, center, radiusMeters, active]);
  return null;
}

export function MapPin({
  id,
  coordinate,
  glyph = '📍',
  onPress,
}: {
  id: string;
  coordinate: Coordinate;
  glyph?: string;
  tone?: 'accent' | 'muted';
  onPress?: () => void;
  testID?: string;
}) {
  const registry = useContext(MapContext);
  useEffect(() => {
    registry?.setMarker(id, coordinate, glyph, onPress);
    return () => registry?.setMarker(id, null, glyph);
  }, [registry, id, coordinate, glyph, onPress]);
  return null;
}

export function MapLine({
  id,
  from,
  to,
}: {
  id: string;
  from: Coordinate;
  to: Coordinate;
}) {
  const registry = useContext(MapContext);
  useEffect(() => {
    registry?.setLine(id, {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [toLngLat(from), toLngLat(to)] },
    });
    return () => registry?.setLine(id, null);
  }, [registry, id, from, to]);
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapCanvas, { MapPin, type Coordinate } from './MapCanvas';
import { apiRequest } from '../api';
import { colors, radius, spacing } from '../theme';

interface MapPickerProps {
  visible: boolean;
  /** Where the map opens; falls back to a sensible default when unknown. */
  initialCenter: Coordinate | null;
  onCancel: () => void;
  onConfirm: (coordinate: Coordinate, locationName: string) => void;
}

const DEFAULT_CENTER: Coordinate = { latitude: 28.6139, longitude: 77.209 };

/**
 * Full-screen "drop a pin" picker.
 *
 * OSM search can't find many Indian offices by name, but the map *renders* the
 * building fine — so this lets the user tap the exact spot. The pin is
 * reverse-geocoded to the surrounding area's name ("Sector 62, Noida"), which
 * is almost always mapped even when the business is not.
 */
export default function MapPicker({
  visible,
  initialCenter,
  onCancel,
  onConfirm,
}: MapPickerProps) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState<Coordinate | null>(null);
  const [resolving, setResolving] = useState(false);

  function handleClose() {
    setPin(null);
    onCancel();
  }

  async function confirm() {
    if (!pin) return;
    setResolving(true);
    let name = `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`;
    try {
      const place = await apiRequest<{ name: string; context: string }>(
        '/places/reverse',
        { query: { lat: pin.latitude, lon: pin.longitude } }
      );
      name = place.context ? `${place.name}, ${place.context}` : place.name;
    } catch {
      // Keep the coordinate label if reverse-geocoding is unreachable.
    }
    setResolving(false);
    setPin(null);
    onConfirm(pin, name);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <MapCanvas
          center={pin ?? initialCenter ?? DEFAULT_CENTER}
          onPress={setPin}
          testID="map-picker"
        >
          {pin && <MapPin id="picked" coordinate={pin} glyph="📍" />}
        </MapCanvas>

        <View style={[styles.banner, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.bannerText}>
            {pin ? 'Tap again to move the pin' : 'Tap the map to place your location'}
          </Text>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            style={styles.cancelButton}
            onPress={handleClose}
            testID="map-picker-cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmButton, !pin && styles.confirmDisabled]}
            onPress={confirm}
            disabled={!pin || resolving}
            testID="map-picker-confirm"
          >
            {resolving ? (
              <ActivityIndicator color={colors.textOnGradient} />
            ) : (
              <Text style={styles.confirmText}>Use this spot</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  bannerText: {
    color: colors.textOnGradient,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cancelButton: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.textOnGradient,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textOnGradient,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    color: colors.textOnGradient,
    fontWeight: '700',
  },
});

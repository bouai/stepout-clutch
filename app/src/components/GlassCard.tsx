import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme';

interface GlassCardProps {
  children: ReactNode;
  /** Layout for the card: padding, margin, flexDirection, gap, minHeight, etc. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A real frosted-glass surface, per the design mockups.
 *
 * The earlier attempt was just `backgroundColor: rgba(255,255,255,0.18)` — a
 * flat transparency with no blur. Over the light coral top of the gradient that
 * muddied into a washed-out pink and white text on it failed contrast. This
 * uses `expo-blur`'s BlurView for an actual backdrop blur, plus a dark scrim as
 * a contrast floor so the white text stays legible wherever the card sits on
 * the gradient — brightest coral included. If a device can't blur, the scrim
 * alone still yields a readable dark-translucent card.
 *
 * The blur and scrim are absolutely positioned, so the caller's `style`
 * (padding, margin, flex layout) applies to the children exactly as it would on
 * a plain View.
 */
export default function GlassCard({ children, style, testID }: GlassCardProps) {
  return (
    <View style={[styles.base, style]} testID={testID}>
      <BlurView
        intensity={24}
        tint="dark"
        style={styles.layer}
        pointerEvents="none"
      />
      <View style={styles.scrim} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.glassScrim,
  },
});

import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { backgroundGradient, colors } from '../theme';

/**
 * The app's "night" backdrop: a deep navy vertical gradient with a faint warm
 * city-glow rising from the bottom and a cool violet bloom in the upper corner.
 * Used behind every screen and every full-screen flow so the whole product
 * shares one atmosphere.
 */
export default function AppBackground({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={backgroundGradient} style={[styles.fill, style]}>
      {/* Cool violet bloom, top-right. */}
      <LinearGradient
        colors={[colors.glowViolet, 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.55 }}
        style={styles.bloom}
        pointerEvents="none"
      />
      {/* Warm city glow rising from the bottom edge. */}
      <LinearGradient
        colors={['transparent', 'transparent', colors.glowWarm]}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bloom}
        pointerEvents="none"
      />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bloom: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { cardShadow, colors, radius } from '../theme';

interface GlassCardProps {
  children: ReactNode;
  /** Layout for the card: padding, margin, flexDirection, gap, minHeight, etc. */
  style?: StyleProp<ViewStyle>;
  /**
   * `hero` adds a brighter top sheen and stronger rim for the primary card on a
   * screen (weather, readiness); `plain` is the default row/section card.
   */
  tone?: 'plain' | 'hero';
  /** Drop the ambient shadow (e.g. cards nested inside another surface). */
  flat?: boolean;
  testID?: string;
}

/**
 * A frosted-glass surface — a dark translucent fill so it reads as glass over
 * the night background, and a hairline rim that catches the light along the
 * edge. Hero cards get an extra top sheen for depth.
 *
 * Uses a solid translucent fill rather than a native backdrop blur: on the dark
 * background the blur is barely perceptible, and requiring the native `expo-blur`
 * module crashed the app on dev-client builds that don't bundle it.
 *
 * The fill/sheen layers are absolutely positioned, so the caller's `style`
 * (padding, margin, flex layout) applies to the children exactly as on a plain
 * View.
 */
export default function GlassCard({
  children,
  style,
  tone = 'plain',
  flat = false,
  testID,
}: GlassCardProps) {
  const hero = tone === 'hero';
  return (
    <View
      style={[
        styles.base,
        hero ? styles.rimHero : styles.rim,
        !flat && cardShadow,
        style,
      ]}
      testID={testID}
    >
      <View
        style={[styles.fill, { backgroundColor: colors.glassFill }]}
        pointerEvents="none"
      />
      {hero && (
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.layer}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
  },
  rim: { borderColor: colors.glassBorder },
  rimHero: { borderColor: colors.glassBorderStrong },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

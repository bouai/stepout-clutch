import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../theme';

/** Clearance for the floating pill nav: its 64pt height plus its 24pt offset. */
export const FLOATING_NAV_CLEARANCE = 100;

interface ScreenContainerProps {
  children: ReactNode;
  /** Rendered as the screen heading above the content. */
  title?: string;
  /**
   * Wrap children in a ScrollView. Screens that embed a MapView must opt out —
   * a map inside a ScrollView fights it for pan gestures — and scroll their own
   * list section instead.
   */
  scrollable?: boolean;
  /** Enables pull-to-refresh. Only meaningful when `scrollable`. */
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
  /** Rendered opposite the title, e.g. a settings button. */
  headerRight?: ReactNode;
  testID?: string;
}

export default function ScreenContainer({
  children,
  title,
  scrollable = true,
  onRefresh,
  refreshing = false,
  contentStyle,
  headerRight,
  testID,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  // Insets replace what used to be a hardcoded `paddingTop: 60`, which was only
  // ever correct on the one device it was eyeballed against.
  const padding = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: insets.bottom + FLOATING_NAV_CLEARANCE,
  };

  const heading =
    title || headerRight ? (
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : <View />}
        {headerRight}
      </View>
    ) : null;

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, padding, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID={testID ?? 'screen-scroll'}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.textOnGradient}
                colors={[colors.accent]}
              />
            ) : undefined
          }
        >
          {heading}
          {children}
        </ScrollView>
      ) : (
        <View
          style={[styles.content, styles.fill, padding, contentStyle]}
          testID={testID ?? 'screen-fixed'}
        >
          {heading}
          {children}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
  },
});

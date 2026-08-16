import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OnboardingDots from './OnboardingDots';
import { colors, radius, spacing } from '../../theme';

interface OnboardingFrameProps {
  step: number;
  onSkip: () => void;
  skipTestID: string;
  /** Emoji shown in the translucent circle; omitted on the welcome screen. */
  icon?: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryTestID: string;
  /** Welcome inverts the CTA: white pill, coral text. */
  invertPrimary?: boolean;
  children?: ReactNode;
}

/**
 * Shared chrome for the three onboarding steps.
 *
 * Each screen previously carried its own flat `backgroundColor` and a
 * hardcoded `paddingTop: 60`. Onboarding was built independently of the visual
 * reskin, so it never picked up either the coral→purple gradient the rest of
 * the app uses or safe-area insets.
 */
export default function OnboardingFrame({
  step,
  onSkip,
  skipTestID,
  icon,
  title,
  subtitle,
  primaryLabel,
  onPrimaryPress,
  primaryTestID,
  invertPrimary = false,
  children,
}: OnboardingFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      <Pressable style={styles.skipButton} onPress={onSkip} testID={skipTestID}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.content}>
        {icon && (
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </View>

      <OnboardingDots total={3} activeIndex={step} />

      <Pressable
        style={[styles.primaryButton, invertPrimary && styles.primaryButtonInverted]}
        onPress={onPrimaryPress}
        testID={primaryTestID}
      >
        <Text
          style={[
            styles.primaryButtonText,
            invertPrimary && styles.primaryButtonTextInverted,
          ]}
        >
          {primaryLabel}
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skipText: {
    color: colors.textOnGradient,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textOnGradient,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textOnGradientMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonInverted: {
    backgroundColor: colors.card,
  },
  primaryButtonText: {
    color: colors.textOnGradient,
    fontWeight: '700',
    fontSize: 16,
  },
  primaryButtonTextInverted: {
    color: colors.accent,
  },
});

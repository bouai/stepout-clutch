import * as Location from 'expo-location';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import OnboardingDots from './OnboardingDots';
import { colors } from '../../theme';

interface Props {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function EnableLocationScreen({ step, onNext, onSkip }: Props) {
  async function handleAllow() {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // Permission outcome doesn't block onboarding progress either way.
    }
    onNext();
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.skipButton}
        onPress={onSkip}
        testID="onboarding-location-skip-button"
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>📍</Text>
        </View>
        <Text style={styles.title}>Enable Location</Text>
        <Text style={styles.subtitle}>
          StepOut uses your location for local weather, distance to saved places, and
          live trip tracking.
        </Text>
      </View>

      <OnboardingDots total={3} activeIndex={step} />

      <Pressable
        style={styles.primaryButton}
        onPress={handleAllow}
        testID="onboarding-allow-location-button"
      >
        <Text style={styles.primaryButtonText}>Allow Location</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#c95d78',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  skipButton: {
    alignSelf: 'flex-end',
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
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textOnGradient,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#FF7A63',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textOnGradient,
    fontWeight: '700',
    fontSize: 16,
  },
});

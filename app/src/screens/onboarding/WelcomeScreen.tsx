import { Pressable, StyleSheet, Text, View } from 'react-native';

import OnboardingDots from './OnboardingDots';

interface Props {
  step: number;
  onNext: () => void;
}

export default function WelcomeScreen({ step, onNext }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        style={styles.skipButton}
        onPress={onNext}
        testID="onboarding-welcome-skip-button"
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome to StepOut</Text>
        <Text style={styles.subtitle}>
          Plan trips, pack smart, and stay on track — all in one place.
        </Text>
      </View>

      <OnboardingDots total={3} activeIndex={step} />

      <Pressable
        style={styles.primaryButton}
        onPress={onNext}
        testID="onboarding-get-started-button"
      >
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF7A63',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  skipButton: {
    alignSelf: 'flex-end',
  },
  skipText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FF7A63',
    fontWeight: '700',
    fontSize: 16,
  },
});

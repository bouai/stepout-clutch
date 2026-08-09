import * as Notifications from 'expo-notifications';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import OnboardingDots from './OnboardingDots';

interface Props {
  step: number;
  onFinish: () => void;
  onSkip: () => void;
}

export default function EnableNotificationsScreen({ step, onFinish, onSkip }: Props) {
  async function handleAllow() {
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // Permission outcome doesn't block onboarding completion either way.
    }
    onFinish();
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.skipButton}
        onPress={onSkip}
        testID="onboarding-notifications-skip-button"
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🔔</Text>
        </View>
        <Text style={styles.title}>Stay in the Know</Text>
        <Text style={styles.subtitle}>
          Turn on notifications to get alerted the moment you enter or leave a saved
          zone.
        </Text>
      </View>

      <OnboardingDots total={3} activeIndex={step} />

      <Pressable
        style={styles.primaryButton}
        onPress={handleAllow}
        testID="onboarding-allow-notifications-button"
      >
        <Text style={styles.primaryButtonText}>Allow Notifications & Finish</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3D2C6B',
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
    color: '#fff',
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import OnboardingFlow from './src/screens/onboarding/OnboardingFlow';

const ONBOARDING_COMPLETE_KEY = 'stepout_onboarding_complete';

export default function App() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkOnboarding() {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (!cancelled) {
          setOnboardingComplete(value === 'true');
        }
      } catch {
        if (!cancelled) {
          setOnboardingComplete(true);
        }
      }
    }

    checkOnboarding();

    return () => {
      cancelled = true;
    };
  }, []);

  async function completeOnboarding() {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch {
      // Persistence failure just means onboarding may show again next launch.
    }
    setOnboardingComplete(true);
  }

  if (onboardingComplete === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!onboardingComplete) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  return <RootNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

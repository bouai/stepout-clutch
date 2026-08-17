import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TripProvider } from './src/context/TripContext';
import RootNavigator from './src/navigation/RootNavigator';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingFlow from './src/screens/onboarding/OnboardingFlow';

const ONBOARDING_COMPLETE_KEY = 'stepout_onboarding_complete';

function Loading() {
  return (
    <View style={styles.loadingContainer} testID="app-loading">
      <ActivityIndicator />
    </View>
  );
}

/** The signed-in app: onboarding once, then the tabs. */
function AuthedApp() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkOnboarding() {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (!cancelled) setOnboardingComplete(value === 'true');
      } catch {
        if (!cancelled) setOnboardingComplete(true);
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

  if (onboardingComplete === null) return <Loading />;
  if (!onboardingComplete) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }
  return (
    <TripProvider>
      <RootNavigator />
    </TripProvider>
  );
}

/** Gates the app behind sign-in. */
function Gate() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <LoginScreen />;
  return <AuthedApp />;
}

export default function App() {
  // `light` because every screen sits on the dark end of the coral→purple
  // gradient; the default dark icons were invisible against it.
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

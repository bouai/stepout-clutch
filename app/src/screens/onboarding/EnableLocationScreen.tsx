import * as Location from 'expo-location';

import OnboardingFrame from './OnboardingFrame';

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
    <OnboardingFrame
      step={step}
      onSkip={onSkip}
      skipTestID="onboarding-location-skip-button"
      icon="📍"
      title="Enable Location"
      subtitle="StepOut uses your location for local weather, distance to saved places, and live trip tracking."
      primaryLabel="Allow Location"
      onPrimaryPress={handleAllow}
      primaryTestID="onboarding-allow-location-button"
    />
  );
}

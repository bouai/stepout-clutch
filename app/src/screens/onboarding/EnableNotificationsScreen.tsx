import * as Notifications from 'expo-notifications';

import OnboardingFrame from './OnboardingFrame';

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
    <OnboardingFrame
      step={step}
      onSkip={onSkip}
      skipTestID="onboarding-notifications-skip-button"
      icon="🔔"
      title="Stay in the Know"
      subtitle="Turn on notifications to get alerted the moment you enter or leave a saved zone."
      primaryLabel="Allow Notifications & Finish"
      onPrimaryPress={handleAllow}
      primaryTestID="onboarding-allow-notifications-button"
    />
  );
}

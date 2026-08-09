import { useState } from 'react';

import EnableLocationScreen from './EnableLocationScreen';
import EnableNotificationsScreen from './EnableNotificationsScreen';
import WelcomeScreen from './WelcomeScreen';

const STEP_COUNT = 3;

interface Props {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);

  function goNext() {
    setStep((prev) => Math.min(prev + 1, STEP_COUNT - 1));
  }

  if (step === 0) {
    return <WelcomeScreen step={step} onNext={goNext} />;
  }

  if (step === 1) {
    return <EnableLocationScreen step={step} onNext={goNext} onSkip={goNext} />;
  }

  return (
    <EnableNotificationsScreen step={step} onFinish={onComplete} onSkip={onComplete} />
  );
}

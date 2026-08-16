import OnboardingFrame from './OnboardingFrame';

interface Props {
  step: number;
  onNext: () => void;
}

export default function WelcomeScreen({ step, onNext }: Props) {
  return (
    <OnboardingFrame
      step={step}
      onSkip={onNext}
      skipTestID="onboarding-welcome-skip-button"
      title="Welcome to StepOut"
      subtitle="Plan trips, pack smart, and stay on track — all in one place."
      primaryLabel="Get Started"
      onPrimaryPress={onNext}
      primaryTestID="onboarding-get-started-button"
      invertPrimary
    />
  );
}

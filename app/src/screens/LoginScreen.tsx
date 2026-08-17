import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing, typography } from '../theme';

type Stage = 'email' | 'link';

/**
 * Magic-link sign in.
 *
 * With no email provider configured (local/dev), the server returns the link
 * token directly and this screen offers a one-tap "continue" — so login works
 * end to end without an inbox. The moment a real sender is wired up, the same
 * flow shows "check your email" instead, with no client change.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { requestLink, verify } = useAuth();

  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('email');
  const [devToken, setDevToken] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmitEmail = /.+@.+\..+/.test(email.trim()) && !busy;

  async function sendLink() {
    if (!canSubmitEmail) return;
    setBusy(true);
    setError(null);

    const result = await requestLink(email.trim());
    setBusy(false);

    if (!result) {
      setError('Could not reach the server. Check your connection.');
      return;
    }
    setDevToken(result.devToken);
    setEmailEnabled(result.emailEnabled);
    setStage('link');
  }

  async function continueWithDevToken() {
    if (!devToken) return;
    setBusy(true);
    setError(null);
    const ok = await verify(devToken);
    setBusy(false);
    if (!ok) setError('That link did not work. Request a new one.');
  }

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={[styles.container, { paddingTop: insets.top + spacing.lg }]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>StepOut</Text>
        <Text style={styles.subtitle}>
          {stage === 'email'
            ? 'Sign in with your email to sync your trips.'
            : emailEnabled
              ? `We sent a sign-in link to ${email.trim()}.`
              : 'Dev mode: no email is sent — continue below.'}
        </Text>

        {stage === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              testID="login-email-input"
            />
            <Pressable
              style={[styles.primaryButton, !canSubmitEmail && styles.buttonDisabled]}
              onPress={sendLink}
              disabled={!canSubmitEmail}
              testID="login-send-button"
            >
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.primaryButtonText}>Send sign-in link</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            {!emailEnabled && devToken && (
              <Pressable
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={continueWithDevToken}
                disabled={busy}
                testID="login-continue-button"
              >
                {busy ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue</Text>
                )}
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                setStage('email');
                setDevToken(null);
                setError(null);
              }}
              testID="login-back-button"
            >
              <Text style={styles.linkText}>Use a different email</Text>
            </Pressable>
          </>
        )}

        {error && (
          <Text style={styles.error} testID="login-error">
            {error}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: 40,
  },
  subtitle: {
    color: colors.textOnGradientMuted,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textOnGradient,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 16,
  },
  linkText: {
    color: colors.textOnGradient,
    textAlign: 'center',
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  error: {
    color: colors.textOnGradient,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.card,
    padding: spacing.sm,
  },
});

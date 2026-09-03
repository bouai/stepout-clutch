import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppBackground from '../components/AppBackground';
import GlassCard from '../components/GlassCard';
import { Button, TextField } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

/**
 * Welcome + sign in.
 *
 * StepOut must never block a new user behind an inbox. "Get Started" signs in
 * instantly as a guest (the dev auth flow hands back a token with no email
 * sent), so the user lands in setup immediately. "Sync with email" is offered
 * as a secondary path for anyone who wants their trips tied to an address — and
 * the moment a real email sender is wired up, that path shows "check your
 * email" instead, with no change here.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { requestLink, verify } = useAuth();

  const [mode, setMode] = useState<'welcome' | 'email' | 'link'>('welcome');
  const [email, setEmail] = useState('');
  const [devToken, setDevToken] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmitEmail = /.+@.+\..+/.test(email.trim()) && !busy;

  async function guestStart() {
    setBusy(true);
    setError(null);
    // A stable-ish guest identity so a returning guest keeps their trips.
    const guestEmail = 'guest@stepout.app';
    const result = await requestLink(guestEmail);
    if (!result?.devToken) {
      setBusy(false);
      setError('Could not reach the server. Check your connection and try again.');
      return;
    }
    const ok = await verify(result.devToken);
    setBusy(false);
    if (!ok) setError('Could not start a session. Please try again.');
  }

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
    setMode('link');
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
    <AppBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoGlyph}>🧭</Text>
          </View>
          <Text style={styles.brand}>StepOut</Text>
          <Text style={styles.tagline}>
            Know what to take.{'\n'}Know when to leave.{'\n'}Never forget the important stuff.
          </Text>
        </View>

        <View style={styles.actions}>
          {mode === 'welcome' && (
            <>
              <Button
                label="Get Started"
                onPress={guestStart}
                loading={busy}
                testID="login-get-started-button"
              />
              <Button
                label="Sync with email"
                variant="ghost"
                onPress={() => {
                  setMode('email');
                  setError(null);
                }}
                testID="login-email-toggle"
              />
            </>
          )}

          {mode === 'email' && (
            <GlassCard style={styles.emailCard}>
              <Text style={styles.emailTitle}>Sync your trips</Text>
              <Text style={styles.emailHint}>
                Enter your email and we'll keep your trips on this address.
              </Text>
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                testID="login-email-input"
              />
              <Button
                label="Send sign-in link"
                onPress={sendLink}
                disabled={!canSubmitEmail}
                loading={busy}
                testID="login-send-button"
              />
              <Button
                label="Back"
                variant="ghost"
                onPress={() => {
                  setMode('welcome');
                  setError(null);
                }}
                testID="login-back-button"
              />
            </GlassCard>
          )}

          {mode === 'link' && (
            <GlassCard style={styles.emailCard}>
              <Text style={styles.emailTitle}>
                {emailEnabled ? 'Check your email' : 'Almost there'}
              </Text>
              <Text style={styles.emailHint}>
                {emailEnabled
                  ? `We sent a sign-in link to ${email.trim()}.`
                  : 'Tap continue to finish signing in.'}
              </Text>
              {!emailEnabled && devToken && (
                <Button
                  label="Continue"
                  onPress={continueWithDevToken}
                  loading={busy}
                  testID="login-continue-button"
                />
              )}
              <Button
                label="Use a different email"
                variant="ghost"
                onPress={() => {
                  setMode('email');
                  setDevToken(null);
                  setError(null);
                }}
              />
            </GlassCard>
          )}

          {error && (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          )}
        </View>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoGlyph: { fontSize: 34 },
  brand: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tagline: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
  emailCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  emailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emailHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

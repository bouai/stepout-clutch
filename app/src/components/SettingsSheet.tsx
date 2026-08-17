import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { API_URL, apiRequest, isLocalOnly } from '../api';
import { useAuth } from '../context/AuthContext';
import { cardShadow, colors, radius, spacing } from '../theme';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful wipe so the app can reload from an empty state. */
  onReset: () => void;
}

export default function SettingsSheet({
  visible,
  onClose,
  onReset,
}: SettingsSheetProps) {
  const { user, logout } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmLogout() {
    Alert.alert('Sign out?', 'You can sign back in with your email any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await logout();
        },
      },
    ]);
  }

  function confirmReset() {
    Alert.alert(
      'Start fresh?',
      'This permanently deletes every trip, checklist item, packing item, saved place and zone. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: performReset },
      ]
    );
  }

  async function performReset() {
    setResetting(true);
    setError(null);

    try {
      await apiRequest('/admin/reset', { method: 'POST', query: { confirm: 'true' } });
      onReset();
      onClose();
    } catch {
      setError('Could not clear data. Check the server connection.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Settings</Text>

          <ScrollView style={styles.body}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <Text style={styles.value} testID="settings-account-email">
              {user?.email ?? 'Not signed in'}
            </Text>
            <Pressable
              style={styles.signOutButton}
              onPress={confirmLogout}
              testID="settings-logout-button"
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>SERVER</Text>
            <Text style={styles.value} testID="settings-api-url">
              {API_URL}
            </Text>
            {isLocalOnly && (
              // Worth calling out loudly: a build pointing at localhost works
              // in a simulator and reaches nothing at all from a phone.
              <Text style={styles.warning} testID="settings-local-warning">
                This build points at localhost, which a phone cannot reach. It
                needs to be rebuilt against a deployed server.
              </Text>
            )}

            <Text style={styles.sectionLabel}>DATA</Text>
            <Text style={styles.helpText}>
              Clears everything and returns the app to a blank slate.
            </Text>

            {error && (
              <Text style={styles.error} testID="settings-reset-error">
                {error}
              </Text>
            )}

            <Pressable
              style={[styles.dangerButton, resetting && styles.buttonDisabled]}
              onPress={confirmReset}
              disabled={resetting}
              testID="settings-reset-button"
            >
              <Text style={styles.dangerButtonText}>
                {resetting ? 'Clearing…' : 'Start fresh'}
              </Text>
            </Pressable>
          </ScrollView>

          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            testID="settings-close-button"
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: '80%',
    ...cardShadow,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  body: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  helpText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  signOutText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  warning: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dangerButtonText: {
    color: colors.textOnGradient,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeButtonText: {
    color: colors.accent,
    fontWeight: '700',
  },
});

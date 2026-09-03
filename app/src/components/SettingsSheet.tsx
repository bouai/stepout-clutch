import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { API_URL, apiRequest, isLocalOnly } from '../api';
import { useAuth } from '../context/AuthContext';
import { resetGuidance } from '../hooks/useGuidance';
import { colors, radius, spacing } from '../theme';
import { Button, SectionLabel } from './ui';
import Sheet from './Sheet';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful wipe so the app can reload from an empty state. */
  onReset: () => void;
}

export default function SettingsSheet({ visible, onClose, onReset }: SettingsSheetProps) {
  const { user, logout } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipsReset, setTipsReset] = useState(false);

  function confirmLogout() {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
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

  async function replayTips() {
    await resetGuidance();
    setTipsReset(true);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" testID="settings-sheet">
      <View style={styles.group}>
        <SectionLabel>Account</SectionLabel>
        <Text style={styles.value} testID="settings-account-email">
          {user?.email ?? 'Not signed in'}
        </Text>
        <Button
          label="Sign out"
          variant="secondary"
          onPress={confirmLogout}
          testID="settings-logout-button"
        />
      </View>

      <View style={styles.group}>
        <SectionLabel>Guidance</SectionLabel>
        <Text style={styles.help}>
          {tipsReset
            ? 'Tips reset — the coach cards will appear again as you explore.'
            : 'Bring back the one-time tips shown on each screen.'}
        </Text>
        <Button
          label={tipsReset ? 'Tips reset ✓' : 'Replay tips'}
          variant="secondary"
          onPress={replayTips}
          disabled={tipsReset}
          testID="settings-replay-tips"
        />
      </View>

      <View style={styles.group}>
        <SectionLabel>Server</SectionLabel>
        <Text style={styles.value} testID="settings-api-url">
          {API_URL}
        </Text>
        {isLocalOnly && (
          <Text style={styles.warning} testID="settings-local-warning">
            This build points at localhost, which a phone cannot reach. It needs to be
            rebuilt against a deployed server.
          </Text>
        )}
      </View>

      <View style={styles.group}>
        <SectionLabel>Data</SectionLabel>
        <Text style={styles.help}>Clears everything and returns the app to a blank slate.</Text>
        {error && (
          <Text style={styles.error} testID="settings-reset-error">
            {error}
          </Text>
        )}
        <Button
          label={resetting ? 'Clearing…' : 'Start fresh'}
          variant="danger"
          onPress={confirmReset}
          disabled={resetting}
          testID="settings-reset-button"
        />
      </View>

      <View style={styles.doneWrap}>
        <Button label="Done" onPress={onClose} testID="settings-close-button" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  value: { fontSize: 14, color: colors.textPrimary },
  help: { fontSize: 13, color: colors.textSecondary },
  warning: {
    fontSize: 12,
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  error: { fontSize: 13, color: colors.danger },
  doneWrap: { marginTop: spacing.sm },
});

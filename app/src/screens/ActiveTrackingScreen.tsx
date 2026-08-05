import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

type ConnectionStatus = 'loading' | 'connected' | 'error';

export default function ActiveTrackingScreen() {
  const [status, setStatus] = useState<ConnectionStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch(`${API_URL}/health`);
        if (!cancelled) {
          setStatus(response.ok ? 'connected' : 'error');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text>Active Tracking</Text>
      {status === 'loading' && <ActivityIndicator style={styles.status} />}
      {status === 'connected' && (
        <Text style={styles.status} testID="connection-status">
          Connected (ok)
        </Text>
      )}
      {status === 'error' && (
        <Text style={styles.status} testID="connection-status">
          Backend unreachable
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    marginTop: 12,
  },
});

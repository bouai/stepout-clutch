import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

export type LoadStatus = 'loading' | 'ready' | 'empty' | 'error';

interface ListStateProps {
  status: LoadStatus;
  /** Shown for `empty`. */
  emptyMessage: string;
  /** Shown for `error`; produced by `describeError`. */
  errorMessage?: string;
  onRetry?: () => void;
  /** Yields `<prefix>-loading` / `-empty` / `-error` / `-retry` test IDs. */
  testIDPrefix: string;
}

/**
 * Renders the non-ready states of a fetched list.
 *
 * Screens used to collapse a failed request into an empty array, so an
 * unreachable server rendered "No items yet" — indistinguishable from having
 * genuinely no data, and read by testers as their data having been lost.
 */
export default function ListState({
  status,
  emptyMessage,
  errorMessage,
  onRetry,
  testIDPrefix,
}: ListStateProps) {
  if (status === 'ready') return null;

  if (status === 'loading') {
    return <ActivityIndicator testID={`${testIDPrefix}-loading`} />;
  }

  if (status === 'empty') {
    return (
      <Text style={styles.empty} testID={`${testIDPrefix}-empty`}>
        {emptyMessage}
      </Text>
    );
  }

  return (
    <View style={styles.errorWrapper}>
      <Text style={styles.error} testID={`${testIDPrefix}-error`}>
        {errorMessage ?? 'Something went wrong.'}
      </Text>
      {onRetry && (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          testID={`${testIDPrefix}-retry`}
          hitSlop={8}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    // These states render inside the (now translucent) glass cards, so the
    // copy needs to read as light-on-gradient rather than dark-on-white.
    color: colors.textOnGradientMuted,
  },
  errorWrapper: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  error: {
    color: colors.danger,
  },
  retryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  retryText: {
    color: colors.textOnGradient,
    fontWeight: '700',
  },
});

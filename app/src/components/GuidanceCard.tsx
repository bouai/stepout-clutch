import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useGuidance } from '../hooks/useGuidance';
import { colors, radius, spacing } from '../theme';

interface GuidanceCardProps {
  /** Stable id — the card shows once per user, then never again. */
  id: string;
  title: string;
  body: string;
  /** Optional call-to-action; tapping it also dismisses the card. */
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

/**
 * A lightweight contextual coach card — an inline, dismissible hint shown the
 * first time a user reaches a screen or feature. Non-blocking: it sits in the
 * scroll flow, explains the area in one line, offers an obvious next step, and
 * a "Got it" that hides it for good.
 */
export default function GuidanceCard({
  id,
  title,
  body,
  actionLabel,
  onAction,
  icon = '💡',
}: GuidanceCardProps) {
  const { ready, dismissed, dismiss } = useGuidance(id);

  if (!ready || dismissed) return null;

  return (
    <View style={styles.card} testID={`guidance-${id}`}>
      <View style={styles.accentEdge} />
      <View style={styles.content}>
        <Text style={styles.title}>
          {icon}  {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          {actionLabel && (
            <Pressable
              onPress={() => {
                onAction?.();
                dismiss();
              }}
              testID={`guidance-${id}-action`}
            >
              <Text style={styles.actionText}>{actionLabel}</Text>
            </Pressable>
          )}
          <Pressable onPress={dismiss} testID={`guidance-${id}-dismiss`} hitSlop={8}>
            <Text style={styles.dismissText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  accentEdge: {
    width: 4,
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

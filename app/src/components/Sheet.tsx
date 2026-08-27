import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Optional caption under the title. */
  subtitle?: string;
  children: ReactNode;
  /** Rendered pinned at the bottom (e.g. Cancel / Create buttons). */
  footer?: ReactNode;
  testID?: string;
}

/**
 * A dark frosted bottom sheet — the single modal surface for the whole app.
 *
 * Replaces the old opaque-white `Modal` cards, which broke the night aesthetic
 * the moment they opened. Tapping the scrim dismisses; content scrolls if it
 * outgrows the sheet; a footer stays pinned for the primary action.
 */
export default function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  testID,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} testID={testID ? `${testID}-scrim` : undefined} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} testID={testID}>
          <View style={[StyleSheet.absoluteFill, styles.sheetFill]} pointerEvents="none" />
          <View style={styles.grabber} />
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          )}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,6,12,0.6)',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetFill: { backgroundColor: colors.glassFillStrong },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: spacing.md,
  },
  header: { marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  body: { flexGrow: 0 },
  bodyContent: { gap: spacing.md, paddingBottom: spacing.sm },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});

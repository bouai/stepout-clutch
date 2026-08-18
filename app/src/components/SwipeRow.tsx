import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '../theme';

const ACTION_WIDTH = 88;

interface SwipeRowProps {
  children: ReactNode;
  onDelete: () => void;
  testID?: string;
}

/**
 * Swipe a row left to reveal a Delete action, instead of a permanent red
 * "Delete" link beside every item — which made the lists read like an admin
 * table. Built on PanResponder/Animated so it needs no native gesture library
 * (and so no dev-client rebuild).
 *
 * The responder only claims clearly-horizontal drags, so vertical scrolling of
 * the list underneath is unaffected.
 */
export default function SwipeRow({ children, onDelete, testID }: SwipeRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  // The list cards are translucent, so a delete action parked permanently
  // behind every row would bleed a faint red. Mount it only while swiping.
  const [revealed, setRevealed] = useState(false);

  const settle = (open: boolean) => {
    openRef.current = open;
    setRevealed(true);
    Animated.spring(translateX, {
      toValue: open ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start(() => {
      if (!open) setRevealed(false);
    });
  };

  const responder = useRef(
    PanResponder.create({
      // Claim only decisively-horizontal drags so the list still scrolls.
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 8,
      onPanResponderMove: (_evt, g) => {
        setRevealed(true);
        const base = openRef.current ? -ACTION_WIDTH : 0;
        const next = Math.min(0, Math.max(-ACTION_WIDTH, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, g) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        settle(base + g.dx < -ACTION_WIDTH / 2);
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      {revealed && (
        <View style={styles.actionLayer}>
          <Pressable
            style={styles.deleteAction}
            onPress={() => {
              settle(false);
              onDelete();
            }}
            testID={testID ? `${testID}-delete` : undefined}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      )}
      <Animated.View
        style={[styles.foreground, { transform: [{ translateX }] }]}
        {...responder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  actionLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteAction: {
    width: ACTION_WIDTH,
    alignSelf: 'stretch',
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: colors.textOnGradient,
    fontWeight: '700',
  },
  foreground: {
    // Transparent so it doesn't double-tint over the already-translucent card.
    // The delete action only occupies the far-right strip, which the row
    // uncovers as it slides — nothing bleeds through the body.
    backgroundColor: 'transparent',
    paddingRight: spacing.xs,
  },
});

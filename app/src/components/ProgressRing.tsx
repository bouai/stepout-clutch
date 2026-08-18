import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '../theme';

interface ProgressRingProps {
  label: string;
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  /** Overrides the centre text (e.g. "67%" for a combined readiness ring). */
  centerLabel?: string;
  /** Renders the text and unfilled track light, for use on a glass card. */
  onGlass?: boolean;
  testID: string;
}

/**
 * A ring whose arc actually tracks progress.
 *
 * The previous version drew a static bordered circle with a percentage inside,
 * so the "ring" conveyed nothing — the number did all the work. The mockup
 * shows a filled arc with the raw fraction, which reads faster and matches how
 * the checklist and packing lists are actually counted.
 */
export default function ProgressRing({
  label,
  completed,
  total,
  size = 76,
  strokeWidth = 7,
  centerLabel,
  onGlass = false,
  testID,
}: ProgressRingProps) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const textColor = onGlass ? colors.textOnGradient : colors.textPrimary;

  return (
    <View style={styles.wrapper} testID={testID}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={onGlass ? colors.ringTrackOnGlass : colors.ringTrack}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            // Remaining arc is hidden; 0 progress leaves the full track bare.
            strokeDashoffset={circumference * (1 - fraction)}
            // Start at 12 o'clock rather than 3.
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.centerContent]}>
          <Text
            style={[centerLabel ? styles.percent : styles.fraction, { color: textColor }]}
            testID={`${testID}-fraction`}
          >
            {centerLabel ?? `${completed}/${total}`}
          </Text>
        </View>
      </View>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fraction: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  percent: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

/**
 * Shared UI primitives for StepOut's dark-glass design system.
 *
 * Every screen composes these instead of hand-rolling styles, so a button, a
 * pill, a toggle or a checkbox looks and behaves identically wherever it
 * appears. Colours, radius and spacing all come from `theme.ts`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  accentGradient,
  accentShadow,
  colors,
  radius,
  spacing,
} from '../theme';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Optional leading glyph/emoji. */
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const inert = disabled || loading;
  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.accent} />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === 'secondary' && styles.btnTextSecondary,
            variant === 'ghost' && styles.btnTextGhost,
            variant === 'danger' && styles.btnTextDanger,
          ]}
        >
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={inert}
        testID={testID}
        style={({ pressed }) => [
          fullWidth && styles.btnFull,
          accentShadow,
          inert && styles.btnDisabled,
          pressed && styles.btnPressed,
          style,
        ]}
      >
        <LinearGradient
          colors={accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnBase}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      testID={testID}
      style={({ pressed }) => [
        styles.btnBase,
        fullWidth && styles.btnFull,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        inert && styles.btnDisabled,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Chip */

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  onLongPress,
  style,
  testID,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed && styles.chipPressed,
        style,
      ]}
    >
      <Text style={selected ? styles.chipTextSelected : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Toggle */

interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  testID?: string;
}

export function Toggle({ value, onValueChange, testID }: ToggleProps) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      testID={testID}
      style={[styles.toggleTrack, value && styles.toggleTrackOn]}
      hitSlop={6}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Checkbox */

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  testID?: string;
}

export function Checkbox({ checked, onPress, testID }: CheckboxProps) {
  return (
    <Pressable onPress={onPress} testID={testID} hitSlop={10} style={styles.checkboxHit}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkboxTick}>✓</Text>}
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------------------- TextField */

interface TextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  onBlur,
  onSubmitEditing,
  style,
  testID,
}: TextFieldProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      autoFocus={autoFocus}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      onBlur={onBlur}
      onSubmitEditing={onSubmitEditing}
      style={[styles.field, style]}
      testID={testID}
    />
  );
}

/* ------------------------------------------------------------ SectionLabel */

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  // Button
  btnBase: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: {
    alignSelf: 'stretch',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  btnTextSecondary: { color: colors.textPrimary },
  btnTextGhost: { color: colors.accent },
  btnTextDanger: { color: colors.danger },
  btnSecondary: {
    backgroundColor: colors.chipIdleBg,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnDanger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
  },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  // Chip
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: colors.chipIdleBg,
    borderColor: colors.chipIdleBorder,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: { opacity: 0.8 },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Toggle
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.toggleOff,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: colors.accent },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.toggleKnob,
  },
  toggleKnobOn: { transform: [{ translateX: 20 }] },

  // Checkbox
  checkboxHit: { padding: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxTick: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },

  // Field
  field: {
    backgroundColor: colors.chipIdleBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontSize: 16,
  },

  // Section label
  sectionLabel: {
    color: colors.sectionLabel,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
});

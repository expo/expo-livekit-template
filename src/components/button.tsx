import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

import { theme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const pressTransition = {
  transitionProperty: 'transform',
  transitionDuration: 120,
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;

/** A round icon button. With a `title` it becomes a pill. */
export function Button({
  icon,
  label,
  title,
  onPress,
  disabled,
  color = theme.text,
  background = theme.surface,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  background?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.button,
        pressTransition,
        title ? styles.pill : styles.round,
        {
          backgroundColor: background,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <SymbolView name={icon} size={24} tintColor={color} />
      {title && <Text style={[styles.title, { color }]}>{title}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  round: { width: 64 },
  pill: { paddingHorizontal: 28 },
  title: { fontSize: 17, fontWeight: '600' },
});

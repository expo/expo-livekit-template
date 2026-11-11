import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { theme } from '@/theme';

/** A compact segmented control. The option names are the labels. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={6}
            onPress={() => {
              if (selected) return;
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              onChange(option);
            }}
          >
            <Animated.Text
              style={[
                styles.label,
                {
                  color: selected ? theme.text : theme.secondary,
                  backgroundColor: selected ? theme.surface : theme.background,
                },
              ]}
            >
              {option}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  label: {
    fontSize: 15,
    fontWeight: '500',
    textTransform: 'capitalize',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    overflow: 'hidden',
    transitionProperty: ['color', 'backgroundColor'],
    transitionDuration: 150,
  },
});

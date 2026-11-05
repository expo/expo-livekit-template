import { Icon, Text } from '@expo/ui';

const symbols = {
  settings: 'slider.horizontal.3',
  captions: 'text.alignleft',
  mic: 'mic',
  'mic-off': 'mic.slash',
  close: 'xmark',
  waveform: 'waveform',
} as const;

export type VoiceGlyphName = keyof typeof symbols;

export function VoiceGlyph({ name, color, size }: { name: VoiceGlyphName; color: string; size: number }) {
  if (process.env.EXPO_OS === 'ios') return <Icon name={symbols[name]} size={size} color={color} />;
  return (
    <Text textStyle={{ color, fontSize: size }}>
      {name === 'close'
        ? '×'
        : name === 'settings' || name === 'captions'
          ? '☰'
          : name === 'mic-off'
            ? '⊘'
            : '≋'}
    </Text>
  );
}

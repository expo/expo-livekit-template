import type { AgentState } from '@livekit/components-react';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import { Transcript } from '@/components/transcript';
import { VISUALIZERS, Visualizer, type VisualizerVariant } from '@/components/visualizer';
import { useVoiceSession } from '@/hooks/use-voice-session';
import { theme } from '@/theme';

const ICONS = {
  start: { ios: 'waveform', android: 'graphic_eq' },
  mic: { ios: 'mic.fill', android: 'mic' },
  muted: { ios: 'mic.slash.fill', android: 'mic_off' },
  end: { ios: 'xmark', android: 'close' },
} as const;

const STATUS: Partial<Record<AgentState, string>> = {
  connecting: 'Connecting',
  initializing: 'Connecting',
  'pre-connect-buffering': 'Listening',
  idle: 'Listening',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

// The visualizer glides between the screen center and the top when a conversation starts or ends.
const glide = LinearTransition.duration(450).easing(Easing.bezier(0.77, 0, 0.175, 1));

export default function VoiceScreen() {
  const voice = useVoiceSession();
  const [variant, setVariant] = useState<VisualizerVariant>('aura');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}
    >
      <Segmented options={VISUALIZERS} value={variant} onChange={setVariant} />

      <View style={styles.stage}>
        <Animated.View layout={glide} style={styles.center}>
          <Visualizer
            variant={variant}
            state={voice.state}
            track={voice.agentTrack}
            size={Math.min(width * 0.8, 320)}
          />
          <Text style={styles.status}>
            {voice.muted && voice.state === 'listening' ? 'Muted' : STATUS[voice.state]}
          </Text>
        </Animated.View>
      </View>

      {voice.active && <Transcript messages={voice.messages} />}

      {voice.error && (
        <Text selectable accessibilityRole="alert" style={styles.error}>
          {voice.error}
        </Text>
      )}

      <Animated.View
        key={String(voice.active)}
        entering={FadeIn.duration(200)}
        style={styles.controls}
      >
        {voice.active ? (
          <>
            <Button
              icon={voice.muted ? ICONS.muted : ICONS.mic}
              label={voice.muted ? 'Unmute microphone' : 'Mute microphone'}
              onPress={voice.toggleMute}
              disabled={!voice.connected}
              color={voice.muted ? theme.background : theme.text}
              background={voice.muted ? theme.text : theme.surface}
            />
            <Button
              icon={ICONS.end}
              label="End conversation"
              onPress={voice.end}
              disabled={!voice.connected}
              background={theme.danger}
            />
          </>
        ) : (
          <Button
            icon={ICONS.start}
            label="Start conversation"
            title="Start conversation"
            onPress={voice.start}
            color={theme.background}
            background={theme.text}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  stage: { flex: 3, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  status: { color: theme.secondary, fontSize: 15, fontWeight: '500', height: 20 },
  error: {
    color: theme.danger,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 12 },
});

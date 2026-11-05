import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Visualizer } from '@/components/visualizer';
import { TranscriptSheet } from '@/components/transcript-sheet';
import { VoiceControl } from '@/components/voice-control';
import { VoiceSettings } from '@/components/voice-settings';
import { usePreferences } from '@/hooks/use-preferences';
import { useVoiceSession } from '@/live/use-voice-session';
import { theme } from '@/theme';

export default function VoiceScreen() {
  const { preferences, update, storageError, ready } = usePreferences();
  const session = useVoiceSession(preferences);
  const voice = preferences.voice;
  const variant = preferences.visualizer;
  const [sheet, setSheet] = useState<'settings' | 'transcript' | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const connected = session.phase === 'connected';
  const connecting = session.phase === 'connecting';
  const disconnecting = session.phase === 'ending';
  const voiceLocked = session.phase !== 'idle';
  const personaSize = Math.min(width * 0.62, height * 0.34, 280);
  const visualizerState = connecting
    ? 'connecting'
    : disconnecting
      ? 'thinking'
      : connected
        ? session.agent.state
        : 'disconnected';
  const status = connecting
    ? 'Connecting'
    : disconnecting
      ? 'Ending conversation'
      : connected
        ? session.muted
          ? 'Microphone muted'
          : 'Conversation active'
        : 'Ready to start a conversation';

  const onPrimaryPress = () => {
    if (disconnecting || !ready) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (connected || connecting) void session.end();
    else void session.start();
  };

  return (
    <View style={styles.screen}>
      <View accessible accessibilityLabel={status} style={styles.center}>
        <Visualizer
          variant={variant}
          state={visualizerState}
          size={personaSize}
          track={connected ? session.agent.microphoneTrack : undefined}
        />
      </View>
      <View style={[styles.toolbar, { top: insets.top + 12 }]}>
        <VoiceControl
          icon="captions"
          label="Show transcript"
          testID="transcript-button"
          onPress={() => setSheet('transcript')}
          size={48}
        />
        <VoiceControl
          icon="settings"
          label="Voice and appearance settings"
          testID="voice-settings-button"
          onPress={() => setSheet('settings')}
          size={48}
        />
      </View>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
        {(session.error || storageError) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {session.error || storageError}
          </Text>
        )}
        <View style={styles.controls}>
          <VoiceControl
            icon={session.muted ? 'mic-off' : 'mic'}
            label={session.muted ? 'Unmute microphone' : 'Mute microphone'}
            testID="session-mute-button"
            disabled={!connected}
            selected={session.muted}
            size={60}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              void session.toggleMute();
            }}
          />
          <VoiceControl
            icon={connected || connecting ? 'close' : 'waveform'}
            label={
              disconnecting
                ? 'Ending conversation'
                : connecting
                  ? 'Cancel connection'
                  : connected
                    ? 'End conversation'
                    : session.error
                      ? 'Retry conversation'
                      : 'Start conversation'
            }
            testID="session-primary-button"
            prominent
            size={64}
            loading={connecting || disconnecting}
            disabled={disconnecting || !ready}
            onPress={onPrimaryPress}
          />
        </View>
      </View>
      <VoiceSettings
        isPresented={sheet === 'settings'}
        onDismiss={() => setSheet(null)}
        voice={voice}
        onVoiceChange={(next) => update({ voice: next })}
        voiceEnabled={ready && !voiceLocked}
        voiceLocked={voiceLocked}
        persona={variant}
        onPersonaChange={(next) => update({ visualizer: next })}
        personaEnabled={ready}
      />
      <TranscriptSheet
        isPresented={sheet === 'transcript'}
        onDismiss={() => setSheet(null)}
        entries={session.messages}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottom: { position: 'absolute', bottom: 0, left: 24, right: 24, gap: 22 },
  controls: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  error: {
    color: theme.danger,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
});

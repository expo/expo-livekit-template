import type { AgentState, TrackReference } from '@livekit/components-react';
import { useMultibandTrackVolume, useTrackVolume } from '@livekit/react-native';
import { View } from 'react-native';

import AgentAudioVisualizer from './agents-ui/agent-audio-visualizer';

export const VISUALIZERS = ['aura', 'wave', 'bar', 'grid', 'radial'] as const;
export type VisualizerVariant = (typeof VISUALIZERS)[number];

// Aura and Wave follow the overall volume. The other styles follow frequency bands.
const BANDS: Partial<Record<VisualizerVariant, number>> = { bar: 5, grid: 15, radial: 24 };
const SILENCE: number[] = [];

/** Measures the agent's audio natively and passes the levels to a LiveKit visualizer. */
export function Visualizer({ variant, state, track, size }: {
  variant: VisualizerVariant;
  state: AgentState;
  track?: TrackReference;
  size: number;
}) {
  const bands = BANDS[variant];
  const volume = useTrackVolume(bands ? undefined : track);
  const volumeBands = useMultibandTrackVolume(bands ? track : undefined, {
    bands,
    minFrequency: 100,
    maxFrequency: 8000,
    updateInterval: 80,
  });
  const box = { width: size, height: size };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={box}
    >
      <AgentAudioVisualizer
        variant={variant}
        state={state}
        volume={track && !bands ? volume : 0}
        volumeBands={track && bands ? volumeBands : SILENCE}
        dom={{
          // Each platform needs a different WebView. On iOS, Expo's DOM WebView rejects the first
          // prop update. On Android, react-native-webview loads the props too late.
          useExpoDOMWebView: process.env.EXPO_OS === 'android',
          scrollEnabled: false,
          style: { ...box, backgroundColor: 'transparent' },
          containerStyle: box,
        }}
      />
    </View>
  );
}

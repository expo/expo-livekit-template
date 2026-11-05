import type { AgentState, TrackReference } from '@livekit/components-react';
import { memo } from 'react';
import { useMultibandTrackVolume, useTrackVolume } from '@livekit/react-native';
import { View } from 'react-native';

import AgentVisualizer from './agent-visualizer';

export const VISUALIZER_VARIANTS = [
  { id: 'aura', label: 'Aura', description: 'A ring of light' },
  { id: 'grid', label: 'Grid', description: 'A field of light' },
  { id: 'bars', label: 'Bars', description: 'Sound in motion' },
] as const;
export type VisualizerVariant = (typeof VISUALIZER_VARIANTS)[number]['id'];
export function isVisualizerVariant(value: unknown): value is VisualizerVariant {
  return VISUALIZER_VARIANTS.some((variant) => variant.id === value);
}

const EMPTY_BANDS: number[] = [];

export const Visualizer = memo(function Visualizer({ variant, state, size, track }: {
  variant: VisualizerVariant;
  state: AgentState;
  size: number;
  track?: TrackReference;
}) {
  const volume = useTrackVolume(variant === 'aura' ? track : undefined);
  const volumeBands = useMultibandTrackVolume(variant === 'aura' ? undefined : track, {
    bands: variant === 'grid' ? 15 : 5,
    minFrequency: 100,
    maxFrequency: 8000,
    updateInterval: 80,
  });

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <AgentVisualizer
        variant={variant}
        state={state}
        volume={track ? volume : 0}
        volumeBands={track ? volumeBands : EMPTY_BANDS}
        size={size}
        dom={{
          useExpoDOMWebView: false,
          scrollEnabled: false,
          style: { width: size, height: size, backgroundColor: 'transparent' },
          containerStyle: { width: size, height: size },
          contentInsetAdjustmentBehavior: 'never',
        }}
      />
    </View>
  );
});

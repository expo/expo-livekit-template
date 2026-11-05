'use dom';

import type { AgentState } from '@livekit/components-react';
import type { DOMProps } from 'expo/dom';
import type { VisualizerVariant } from './visualizer';
import { AgentAudioVisualizerAura } from './agents-ui/agent-audio-visualizer-aura';
import { AgentAudioVisualizerBar } from './agents-ui/agent-audio-visualizer-bar';
import { AgentAudioVisualizerGrid } from './agents-ui/agent-audio-visualizer-grid';
import './agents-ui/visualizers.css';

function clampVolume(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export default function AgentVisualizer({ state, volume, volumeBands, variant, size }: {
  state: AgentState;
  volume: number;
  volumeBands: number[];
  variant: VisualizerVariant;
  size: number;
  dom?: DOMProps;
}) {
  return (
    <div className="agent-visualizer-stage" aria-hidden="true" data-testid={`visualizer-${variant}`}>
      {variant === 'aura' ? (
        <AgentAudioVisualizerAura state={state} volume={clampVolume(volume)} />
      ) : variant === 'grid' ? (
        <AgentAudioVisualizerGrid state={state} volumeBands={volumeBands.map(clampVolume)} size={size < 224 ? 'sm' : 'md'} />
      ) : (
        <AgentAudioVisualizerBar state={state} volumeBands={volumeBands.map(clampVolume)} size={size < 224 ? 'md' : 'lg'} />
      )}
    </div>
  );
}

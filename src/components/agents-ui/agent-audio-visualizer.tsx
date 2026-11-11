'use dom';

import type { AgentState } from '@livekit/components-react';
import type { DOMProps } from 'expo/dom';

import type { VisualizerVariant } from '../visualizer';
import { AgentAudioVisualizerAura } from './agent-audio-visualizer-aura';
import { AgentAudioVisualizerBar } from './agent-audio-visualizer-bar';
import { AgentAudioVisualizerGrid } from './agent-audio-visualizer-grid';
import { AgentAudioVisualizerRadial } from './agent-audio-visualizer-radial';
import { AgentAudioVisualizerWave } from './agent-audio-visualizer-wave';
import './visualizers.css';

/** The LiveKit Agents UI audio visualizers, drawn in an Expo DOM component. */
export default function AgentAudioVisualizer({ variant, state, volume, volumeBands }: {
  variant: VisualizerVariant;
  state: AgentState;
  volume: number;
  volumeBands: number[];
  dom?: DOMProps;
}) {
  const bands = { state, volumeBands };
  return (
    <div className="lk-stage">
      {variant === 'aura' && <AgentAudioVisualizerAura state={state} volume={volume} />}
      {variant === 'wave' && <AgentAudioVisualizerWave state={state} volume={volume} />}
      {variant === 'bar' && <AgentAudioVisualizerBar {...bands} size="lg" />}
      {variant === 'grid' && <AgentAudioVisualizerGrid {...bands} size="md" />}
      {variant === 'radial' && <AgentAudioVisualizerRadial {...bands} />}
    </div>
  );
}

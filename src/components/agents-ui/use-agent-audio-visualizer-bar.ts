import { useMemo } from 'react';
import { useAnimationSequence } from './use-animation-sequence';
import { type AgentState } from '@livekit/components-react';

function generateConnectingSequenceBar(columns: number): number[][] {
  const seq = [];

  for (let x = 0; x < columns; x++) {
    seq.push([x, columns - 1 - x]);
  }

  return seq;
}

function generateListeningSequenceBar(columns: number): number[][] {
  const center = Math.floor(columns / 2);
  const noIndex = -1;

  return [[center], [noIndex]];
}

export function useAgentAudioVisualizerBarAnimator(
  state: AgentState,
  columns: number,
  interval: number,
): number[] {
  const frames = useMemo(() => {
    if (state === 'connecting' || state === 'initializing') {
      return generateConnectingSequenceBar(columns);
    }
    if (state === 'listening' || state === 'thinking') {
      return generateListeningSequenceBar(columns);
    }
    if (state === 'speaking') return [Array.from({ length: columns }, (_, index) => index)];
    return [[]];
  }, [state, columns]);

  return useAnimationSequence(frames, interval);
}

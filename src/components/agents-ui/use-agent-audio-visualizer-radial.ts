import { useMemo } from 'react';
import { type AgentState } from '@livekit/components-react';
import { useAnimationSequence } from './use-animation-sequence';

function findGcdLessThan(columns: number, max: number = columns): number {
  function gcd(a: number, b: number): number {
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }
  for (let i = max; i >= 1; i--) {
    if (gcd(columns, i) === i) {
      return i;
    }
  }
  return 1;
}

function generateConnectingSequenceBar(columns: number): number[][] {
  const seq = [];
  const center = Math.floor(columns / 2);

  for (let x = 0; x < columns; x++) {
    seq.push([x, (x + center) % columns]);
  }

  return seq;
}

function generateListeningSequenceBar(columns: number): number[][] {
  const divisor = columns > 8 ? columns / findGcdLessThan(columns, 4) : findGcdLessThan(columns, 2);

  return Array.from({ length: divisor }, (_, idx) => [
    ...Array(Math.floor(columns / divisor))
      .fill(1)
      .map((_, idx2) => idx2 * divisor + idx),
  ]);
}

export function useAgentAudioVisualizerRadialAnimator(
  state: AgentState,
  barCount: number,
  interval: number,
): number[] {
  const frames = useMemo(() => {
    if (state === 'connecting' || state === 'initializing') {
      return generateConnectingSequenceBar(barCount);
    }
    if (state === 'listening') {
      return generateListeningSequenceBar(barCount);
    }
    if (state === 'thinking' || state === 'speaking') {
      return [Array.from({ length: barCount }, (_, index) => index)];
    }
    return [[]];
  }, [state, barCount]);

  return useAnimationSequence(frames, interval);
}

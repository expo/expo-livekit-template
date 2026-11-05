import { useMemo } from 'react';
import { useAnimationSequence } from './use-animation-sequence';
import { type AgentState } from '@livekit/components-react';

interface Coordinate {
  x: number;
  y: number;
}

function generateConnectingSequence(rows: number, columns: number, radius: number) {
  const seq = [];
  const centerY = Math.floor(rows / 2);

  const topLeft = {
    x: Math.max(0, centerY - radius),
    y: Math.max(0, centerY - radius),
  };
  const bottomRight = {
    x: columns - 1 - topLeft.x,
    y: Math.min(rows - 1, centerY + radius),
  };

  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    seq.push({ x, y: topLeft.y });
  }

  for (let y = topLeft.y + 1; y <= bottomRight.y; y++) {
    seq.push({ x: bottomRight.x, y });
  }

  for (let x = bottomRight.x - 1; x >= topLeft.x; x--) {
    seq.push({ x, y: bottomRight.y });
  }

  for (let y = bottomRight.y - 1; y > topLeft.y; y--) {
    seq.push({ x: topLeft.x, y });
  }

  return seq;
}

function generateListeningSequence(rows: number, columns: number) {
  const center = { x: Math.floor(columns / 2), y: Math.floor(rows / 2) };
  const noIndex = { x: -1, y: -1 };

  return [center, noIndex, noIndex, noIndex, noIndex, noIndex, noIndex, noIndex, noIndex];
}

function generateThinkingSequence(rows: number, columns: number) {
  const seq = [];
  const y = Math.floor(rows / 2);
  for (let x = 0; x < columns; x++) {
    seq.push({ x, y });
  }
  for (let x = columns - 1; x >= 0; x--) {
    seq.push({ x, y });
  }

  return seq;
}

export function useAgentAudioVisualizerGridAnimator(
  state: AgentState,
  rows: number,
  columns: number,
  interval: number,
  radius?: number,
): Coordinate {
  const frames = useMemo(() => {
    if (state === 'thinking') return generateThinkingSequence(rows, columns);
    if (state === 'listening') return generateListeningSequence(rows, columns);
    if (state === 'connecting' || state === 'initializing') {
      const maximumRadius = Math.floor(Math.max(rows, columns) / 2);
      return generateConnectingSequence(rows, columns, Math.min(radius ?? maximumRadius, maximumRadius));
    }
    return [{ x: Math.floor(columns / 2), y: Math.floor(rows / 2) }];
  }, [state, rows, columns, radius]);

  return useAnimationSequence(frames, interval);
}

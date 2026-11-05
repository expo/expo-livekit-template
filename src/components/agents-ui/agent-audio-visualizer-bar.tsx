import type { AgentState } from '@livekit/components-react';

import { useAgentAudioVisualizerBarAnimator } from './use-agent-audio-visualizer-bar';
import { normalizeVolumeBands } from './volume-bands';

const BAR_COUNT = 5;
const IDLE_BANDS: number[] = Array(BAR_COUNT).fill(0);
const INTERVALS: Partial<Record<AgentState, number>> = {
  connecting: 2000 / BAR_COUNT,
  initializing: 2000,
  listening: 500,
  thinking: 150,
};

export function AgentAudioVisualizerBar({ state, volumeBands, size }: {
  state: AgentState;
  volumeBands: number[];
  size: 'md' | 'lg';
}) {
  const highlighted = useAgentAudioVisualizerBarAnimator(state, BAR_COUNT, INTERVALS[state] ?? 1000);
  const bands = state === 'speaking' ? normalizeVolumeBands(volumeBands, BAR_COUNT) : IDLE_BANDS;

  return (
    <div data-lk-state={state} className={`lk-bars lk-bars-${size}`}>
      {bands.map((band, index) => (
        <div
          key={index}
          data-lk-index={index}
          data-lk-highlighted={highlighted.includes(index)}
          style={{ height: `${band * 100}%` }}
          className="lk-bar-element"
        />
      ))}
    </div>
  );
}

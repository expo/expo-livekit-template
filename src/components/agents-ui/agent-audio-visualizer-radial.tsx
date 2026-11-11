import type { AgentState } from '@livekit/components-react';

import { useAgentAudioVisualizerRadialAnimator } from './use-agent-audio-visualizer-radial';
import { normalizeVolumeBands } from './volume-bands';

const BAR_COUNT = 24;
const RADIUS = 64;
const DOT_SIZE = (RADIUS * Math.PI) / BAR_COUNT;
const INTERVALS: Partial<Record<AgentState, number>> = {
  connecting: 500,
  initializing: 250,
  listening: 500,
};

export function AgentAudioVisualizerRadial({ state, volumeBands }: {
  state: AgentState;
  volumeBands: number[];
}) {
  const interval = INTERVALS[state] ?? 1000;
  const highlighted = useAgentAudioVisualizerRadialAnimator(state, BAR_COUNT, interval);
  const bands = normalizeVolumeBands(volumeBands, BAR_COUNT);

  return (
    <div data-lk-state={state} className="lk-radial">
      {bands.map((band, index) => (
        <div
          key={index}
          className="lk-radial-spoke"
          style={{ transform: `rotate(${(index / BAR_COUNT) * 360}deg) translateY(${RADIUS}px)` }}
        >
          <div
            data-lk-index={index}
            data-lk-highlighted={highlighted.includes(index)}
            className="lk-radial-bar"
            style={{
              width: DOT_SIZE,
              minHeight: DOT_SIZE,
              height: state === 'speaking' ? DOT_SIZE * 10 * band : 0,
            }}
          />
        </div>
      ))}
    </div>
  );
}

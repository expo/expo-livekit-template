import type { AgentState } from '@livekit/components-react';

import { useAgentAudioVisualizerGridAnimator } from './use-agent-audio-visualizer-grid';
import { normalizeVolumeBands } from './volume-bands';

const ROWS = 15;
const COLUMNS = 15;
const INTERVAL = 100;
const MIDDLE_ROW = Math.floor(ROWS / 2);
const CELLS = Array.from({ length: ROWS * COLUMNS }, (_, index) => ({
  x: index % COLUMNS,
  y: Math.floor(index / COLUMNS),
}));

export function AgentAudioVisualizerGrid({ state, volumeBands, size }: {
  state: AgentState;
  volumeBands: number[];
  size: 'sm' | 'md';
}) {
  const active = useAgentAudioVisualizerGridAnimator(state, ROWS, COLUMNS, INTERVAL, 3);
  const bands = normalizeVolumeBands(volumeBands, COLUMNS);
  const speaking = state === 'speaking';
  return (
    <div
      data-lk-state={state}
      className={`lk-grid lk-grid-${size}`}
      style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}
    >
      {CELLS.map(({ x, y }, index) => {
        const highlighted = speaking
          ? bands[x] >= Math.abs(MIDDLE_ROW - y) / (MIDDLE_ROW + 1)
          : active.x === x && active.y === y;
        const duration = INTERVAL / (highlighted ? 1000 : 100);
        return (
          <div
            key={index}
            data-lk-index={index}
            data-lk-highlighted={highlighted}
            style={speaking ? undefined : { transitionDuration: `${duration}s` }}
            className="lk-grid-cell"
          />
        );
      })}
    </div>
  );
}

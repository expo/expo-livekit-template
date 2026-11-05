import { useEffect, useState } from 'react';

export function useAnimationSequence<T>(frames: T[], interval: number): T {
  const [current, setCurrent] = useState({ frames, index: 0 });

  useEffect(() => {
    if (frames.length <= 1) return;
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % frames.length;
      setCurrent({ frames, index });
    }, interval);
    return () => clearInterval(timer);
  }, [frames, interval]);

  return frames[current.frames === frames ? current.index : 0];
}

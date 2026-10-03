import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/game-store';
import { presentationMoment } from './presentation-state';
import type { PresentationMoment } from './presentation-state';

/** Expired frames are skipped after refresh or a background-tab timer delay. */
export function useGamePresentation(): PresentationMoment {
  const game = useGameStore((state) => state.visible);
  const receivedAt = useGameStore((state) => state.presentationReceivedAt);
  const [, refresh] = useState(0);
  const moment = presentationMoment(game, receivedAt, Date.now());
  useEffect(() => {
    if (!moment.locked) return;
    const timer = setTimeout(() => refresh((value) => value + 1),
      Math.max(1, moment.nextAt - Date.now()));
    return () => clearTimeout(timer);
  }, [moment.locked, moment.nextAt]);
  return moment;
}

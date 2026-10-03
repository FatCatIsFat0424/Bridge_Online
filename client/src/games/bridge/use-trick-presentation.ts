import { useCallback, useState, useSyncExternalStore } from 'react';
import { useGameStore } from '../../stores/game-store';
import { useRoomStore } from '../../stores/room-store';
import { createTrickPresentation } from './trick-presentation';
import type { TrickPresentation, TrickSnapshot } from './trick-presentation';

function currentSnapshot(): TrickSnapshot {
  const { phase, playing } = useGameStore.getState();
  return { roomCode: useRoomStore.getState().currentRoomCode, phase, playing };
}

/** Subscribe before React batches successive trick and scoring snapshots. */
export function useTrickPresentation(): TrickPresentation | null {
  const [presentation] = useState(() => createTrickPresentation(currentSnapshot()));
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      const unsubscribe = presentation.subscribe(listener);
      const update = (): void => presentation.update(currentSnapshot());
      const unsubscribeGame = useGameStore.subscribe(update);
      const unsubscribeRoom = useRoomStore.subscribe(update);
      update();
      return () => {
        unsubscribe();
        unsubscribeGame();
        unsubscribeRoom();
        presentation.dispose();
      };
    },
    [presentation],
  );
  return useSyncExternalStore(subscribe, presentation.getSnapshot);
}

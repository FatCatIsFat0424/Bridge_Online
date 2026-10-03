import { useEffect } from 'react';
import { createTurnSound } from '../audio/turn-sound';
import { createTurnSoundController } from '../audio/turn-sound-controller';
import type { TurnSoundSnapshot } from '../audio/turn-sound-controller';
import { useAccountStore } from '../stores/account-store';
import { useGameStore } from '../stores/game-store';
import { useRoomStore } from '../stores/room-store';
import { useTurnSoundStore } from '../stores/turn-sound-store';

export function getTurnSoundSnapshot(): TurnSoundSnapshot {
  const game = useGameStore.getState();
  const room = useRoomStore.getState();
  const account = useAccountStore.getState();
  const owned = room.currentRoomCode && room.mySeat &&
    account.status === 'authenticated' && account.connection === 'ready' &&
    (game.phase === 'bidding' || game.phase === 'playing') &&
    game.currentTurnSeat === room.mySeat;
  const completedTricks = game.playing?.completedTricks.length ?? 0;
  const actionCount = game.bigTwo?.log.filter((entry) =>
    'seat' in entry && entry.seat === room.mySeat).length ??
    game.ninetyNine?.log.filter((entry) => entry.seat === room.mySeat).length ?? 0;
  return {
    room: room.currentRoomCode,
    turn: owned ? [game.gameType, game.phase, room.mySeat, completedTricks,
      game.redPoints?.step ?? '', actionCount].join(':') : null,
    completedTricks,
    enabled: useTurnSoundStore.getState().enabled,
  };
}

/** Mount once in the persistent application shell. */
export function useTurnSound(): void {
  useEffect(() => {
    const audio = createTurnSound();
    const controller = createTurnSoundController(audio);
    let disposed = false;
    let queued = false;
    const update = (): void => {
      if (queued) return;
      queued = true;
      // Socket events can update several stores synchronously for one transition.
      queueMicrotask(() => {
        queued = false;
        if (!disposed) controller.update(getTurnSoundSnapshot());
      });
    };
    const unlock = (event: Event): void => {
      if (event.isTrusted) audio.unlock();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const unsubscribe = [useGameStore.subscribe(update), useRoomStore.subscribe(update),
      useAccountStore.subscribe(update), useTurnSoundStore.subscribe(update)];
    update();
    return () => {
      disposed = true;
      unsubscribe.forEach((remove) => remove());
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      controller.dispose();
    };
  }, []);
}

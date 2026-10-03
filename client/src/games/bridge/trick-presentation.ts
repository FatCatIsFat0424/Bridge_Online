import type { GamePhase, PlayingState, TrickRecord } from '@shared/types';

export const TRICK_HOLD_MS = 1_500;

export interface TrickSnapshot {
  roomCode: string | null;
  phase: GamePhase | null;
  playing: PlayingState | null;
}

export interface TrickPresentation {
  trick: TrickRecord;
  number: number;
}

/** Preserve completed tricks while newer authoritative snapshots continue arriving. */
export function createTrickPresentation(initial: TrickSnapshot): {
  getSnapshot: () => TrickPresentation | null;
  subscribe: (listener: () => void) => () => void;
  update: (snapshot: TrickSnapshot) => void;
  dispose: () => void;
} {
  let previous = initial;
  let seen = initial.playing?.completedTricks.length ?? 0;
  let displayed: TrickPresentation | null = null;
  let pending: TrickPresentation[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  function publish(next: TrickPresentation | null): void {
    if (displayed === next) return;
    displayed = next;
    for (const listener of listeners) listener();
  }

  function cancel(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = [];
    publish(null);
  }

  function advance(): void {
    timer = null;
    publish(pending.shift() ?? null);
    if (displayed) timer = setTimeout(advance, TRICK_HOLD_MS);
  }

  return {
    getSnapshot: () => displayed,
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(snapshot): void {
      const history = snapshot.playing?.completedTricks ?? [];
      const active = snapshot.phase === 'playing' || snapshot.phase === 'scoring';
      const baseline =
        previous.playing === null || (previous.phase !== 'playing' && previous.phase !== 'scoring');
      const reset =
        snapshot.roomCode !== previous.roomCode || !active || history.length < seen || baseline;
      previous = snapshot;
      if (reset) {
        cancel();
        seen = history.length;
        return;
      }
      for (let index = seen; index < history.length; index += 1) {
        pending.push({ trick: history[index], number: index + 1 });
      }
      seen = history.length;
      if (!displayed && pending.length > 0) advance();
    },
    dispose(): void {
      listeners.clear();
      cancel();
    },
  };
}

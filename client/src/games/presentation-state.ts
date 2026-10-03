import type { PlayerVisibleGameState } from '@shared/types';
import { getPresentationFrames } from '@shared/game-presentation';
import type { PresentationFrame } from '@shared/game-presentation';

export interface PresentationMoment {
  frame: PresentationFrame | null;
  locked: boolean;
  nextAt: number;
  endsAt: number;
  frameStartedAt: number;
}

/** Map server deadlines onto local time without extending them on duplicate snapshots. */
export function presentationMoment(
  game: PlayerVisibleGameState | null, receivedAt: number, now: number,
): PresentationMoment {
  const empty = { frame: null, locked: false, nextAt: 0, endsAt: 0, frameStartedAt: 0 };
  if (!game?.presentation) return empty;
  const frames = getPresentationFrames(game);
  const metadata = game.presentation;
  const start = metadata.serverNow === undefined ? metadata.startedAt
    : receivedAt + metadata.startedAt - metadata.serverNow;
  const endsAt = start + frames.reduce((total, frame) => total + frame.durationMs, 0);
  if (now >= endsAt || frames.length === 0) return empty;
  let cursor = start;
  for (const frame of frames) {
    const nextAt = cursor + frame.durationMs;
    if (now < nextAt) return { frame, locked: true, nextAt, endsAt, frameStartedAt: cursor };
    cursor = nextAt;
  }
  return empty;
}

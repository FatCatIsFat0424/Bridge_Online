import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayingState, TrickRecord } from '@shared/types';
import { createTrickPresentation } from '../../../client/src/games/bridge/trick-presentation';
import type { TrickSnapshot } from '../../../client/src/games/bridge/trick-presentation';

const trick: TrickRecord = {
  cards: {
    N: { suit: 'hearts', rank: 14 },
    E: { suit: 'hearts', rank: 2 },
    S: { suit: 'hearts', rank: 3 },
    W: { suit: 'hearts', rank: 4 },
  },
  leadSeat: 'N',
  winnerSeat: 'N',
};

function snapshot(count: number, overrides: Partial<TrickSnapshot> = {}): TrickSnapshot {
  const playing: PlayingState = {
    currentTrick: {},
    trickLeadSeat: 'N',
    currentTurnSeat: 'N',
    completedTricks: Array.from({ length: count }, () => trick),
    trickCountNS: count,
    trickCountEW: 0,
  };
  return { roomCode: 'ABC123', phase: 'playing', playing, ...overrides };
}

describe('completed trick presentation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('should display a new complete trick for 1500ms without losing newer live snapshots', () => {
    const presentation = createTrickPresentation(snapshot(0));
    presentation.update(snapshot(1));
    expect(presentation.getSnapshot()).toEqual({ trick, number: 1 });
    vi.advanceTimersByTime(1_000);
    presentation.update(snapshot(1));
    vi.advanceTimersByTime(499);
    expect(presentation.getSnapshot()?.number).toBe(1);
    vi.advanceTimersByTime(1);
    expect(presentation.getSnapshot()).toBeNull();
    presentation.dispose();
  });

  it('should queue fast successive completed tricks rather than replacing the current hold', () => {
    const presentation = createTrickPresentation(snapshot(0));
    presentation.update(snapshot(1));
    presentation.update(snapshot(3));
    expect(presentation.getSnapshot()?.number).toBe(1);
    vi.advanceTimersByTime(1_500);
    expect(presentation.getSnapshot()?.number).toBe(2);
    vi.advanceTimersByTime(1_500);
    expect(presentation.getSnapshot()?.number).toBe(3);
    vi.advanceTimersByTime(1_500);
    expect(presentation.getSnapshot()).toBeNull();
    presentation.dispose();
  });

  it('should hold the thirteenth trick even when the same snapshot enters scoring', () => {
    const presentation = createTrickPresentation(snapshot(12));
    presentation.update(snapshot(13, { phase: 'scoring' }));
    expect(presentation.getSnapshot()?.number).toBe(13);
    vi.advanceTimersByTime(1_499);
    expect(presentation.getSnapshot()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(presentation.getSnapshot()).toBeNull();
    presentation.dispose();
  });

  it('should not replay completed history when mounting after a refresh', () => {
    const presentation = createTrickPresentation(snapshot(8));
    presentation.update(snapshot(8));
    expect(presentation.getSnapshot()).toBeNull();
    presentation.update(snapshot(9));
    expect(presentation.getSnapshot()?.number).toBe(9);
    presentation.dispose();
  });

  it('should baseline a restored game after mounting with no playing state', () => {
    const presentation = createTrickPresentation(snapshot(0, { phase: null, playing: null }));
    presentation.update(snapshot(8));
    expect(presentation.getSnapshot()).toBeNull();
    presentation.update(snapshot(9));
    expect(presentation.getSnapshot()?.number).toBe(9);
    presentation.dispose();
  });

  it('should cancel queued displays when room, phase, or completed history resets', () => {
    for (const next of [
      snapshot(0),
      snapshot(8, { roomCode: 'NEW123' }),
      snapshot(0, { phase: 'bidding', playing: null }),
    ]) {
      const presentation = createTrickPresentation(snapshot(0));
      presentation.update(snapshot(2));
      presentation.update(next);
      expect(presentation.getSnapshot()).toBeNull();
      vi.advanceTimersByTime(10_000);
      expect(presentation.getSnapshot()).toBeNull();
      presentation.dispose();
    }
  });

  it('should cancel timers and listeners on unmount', () => {
    const presentation = createTrickPresentation(snapshot(0));
    const listener = vi.fn();
    presentation.subscribe(listener);
    presentation.update(snapshot(2));
    expect(listener).toHaveBeenCalledOnce();
    presentation.dispose();
    vi.advanceTimersByTime(10_000);
    expect(listener).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

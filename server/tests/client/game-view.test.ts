import { describe, expect, it } from 'vitest';
import type { PlayingState } from '@shared/types';
import { auctionRows, formatCountdown, remainingCards } from '../../../client/src/game-view';
import type { AuctionCall } from '../../../client/src/game-view';

const pass = { type: 'pass' } as const;
const calls: AuctionCall[] = [
  { seat: 'N', action: { type: 'bid', level: 2, suit: 'hearts' } },
  { seat: 'E', action: pass },
  { seat: 'S', action: pass },
  { seat: 'W', action: pass },
];

describe('auctionRows', () => {
  it('pads before the dealer column and after the last call', () => {
    const rows = auctionRows(calls, 'N');
    expect(rows).toEqual([
      [null, calls[0], calls[1], calls[2]],
      [calls[3], null, null, null],
    ]);
  });
  it('starts in the first column when west deals', () => {
    const rows = auctionRows([{ seat: 'W', action: pass }], 'W');
    expect(rows).toEqual([[{ seat: 'W', action: pass }, null, null, null]]);
  });
  it('returns no rows for an empty auction', () => {
    expect(auctionRows([], 'S')).toEqual([]);
  });
});

describe('remainingCards', () => {
  it('is 13 before play starts', () => {
    expect(remainingCards('E', null)).toBe(13);
  });
  it('subtracts completed tricks and a card already in the current trick', () => {
    const playing = {
      currentTrick: { W: { suit: 'spades', rank: 3 } },
      trickLeadSeat: 'W',
      currentTurnSeat: 'N',
      completedTricks: new Array(5).fill(null),
      trickCountEW: 3,
      trickCountNS: 2,
    } as unknown as PlayingState;
    expect(remainingCards('W', playing)).toBe(7);
    expect(remainingCards('N', playing)).toBe(8);
  });
});

describe('formatCountdown', () => {
  it('should round up to whole seconds as m:ss and never go negative', () => {
    expect(formatCountdown(180_000)).toBe('3:00');
    expect(formatCountdown(59_001)).toBe('1:00');
    expect(formatCountdown(9_500)).toBe('0:10');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5_000)).toBe('0:00');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, PlayerInfo, Seat } from '@shared/types';
import * as deck from '../../src/engine/deck';
import { isRedealEligible } from '../../src/engine/dealing';
import { exportGames, getGameState, handleRedealResponse, restoreGames } from '../../src/managers/game-manager';

function player(seat: Seat): PlayerInfo {
  return { id: seat, username: `player_${seat}`, nickname: seat, color: '#2563eb', avatar: 'cat',
    avatarImage: null };
}

function twoEligiblePlayers(): GameState {
  const cards = deck.createDeck();
  const ordered = [...cards.filter((card) => card.rank <= 10), ...cards.filter((card) => card.rank > 10)];
  return {
    id: 'redeal-test', roomCode: 'ABCDEF', startedAt: 1,
    players: { N: player('N'), E: player('E'), S: player('S'), W: player('W') },
    phase: 'redeal_pending', dealerSeat: 'W',
    hands: { N: ordered.slice(0, 13), E: ordered.slice(13, 26), S: ordered.slice(26, 39), W: ordered.slice(39) },
    bidding: null, contract: null, playing: null, result: null, log: [],
    redealPendingSeat: 'N', redealDeclinedSeats: [],
  };
}

describe('persisted redeal progress', () => {
  beforeEach((): void => {
    const game = twoEligiblePlayers();
    expect(isRedealEligible(game.hands.N)).toBe(true);
    expect(isRedealEligible(game.hands.E)).toBe(true);
    expect(isRedealEligible(game.hands.S)).toBe(false);
    expect(isRedealEligible(game.hands.W)).toBe(false);
    restoreGames([game]);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
    restoreGames([]);
  });

  it('should remember a declined player across restoration and advance to bidding', () => {
    expect(handleRedealResponse('ABCDEF', 'N', false)).toEqual({ success: true });
    expect(getGameState('ABCDEF')).toMatchObject({
      phase: 'redeal_pending', redealPendingSeat: 'E', redealDeclinedSeats: ['N'],
    });
    const persisted = structuredClone(exportGames());
    restoreGames([]);
    restoreGames(persisted);
    expect(handleRedealResponse('ABCDEF', 'E', false)).toEqual({ success: true });
    expect(getGameState('ABCDEF')).toMatchObject({
      phase: 'bidding', redealPendingSeat: null,
      bidding: { currentBidderSeat: 'N', bids: [] },
    });
  });

  it('should allow a previously declined player to decide again after new cards are dealt', () => {
    expect(handleRedealResponse('ABCDEF', 'N', false)).toEqual({ success: true });
    const hands = twoEligiblePlayers().hands;
    const dealOrder = Array.from({ length: 13 }, (_, index) =>
      [hands.N[index], hands.E[index], hands.S[index], hands.W[index]]).flat();
    vi.spyOn(deck, 'shuffleDeck').mockReturnValue(dealOrder);
    expect(handleRedealResponse('ABCDEF', 'E', true)).toEqual({ success: true });
    expect(getGameState('ABCDEF')).toMatchObject({
      phase: 'redeal_pending', redealPendingSeat: 'N', redealDeclinedSeats: [],
    });
    expect(handleRedealResponse('ABCDEF', 'N', false)).toEqual({ success: true });
    expect(handleRedealResponse('ABCDEF', 'E', false)).toEqual({ success: true });
    expect(getGameState('ABCDEF')?.phase).toBe('bidding');
  });
});

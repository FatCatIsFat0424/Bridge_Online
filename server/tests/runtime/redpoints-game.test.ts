import { beforeEach, describe, expect, it } from 'vitest';
import type { Card, PlayerInfo, RedPointsGameState, Seat } from '@shared/types';
import { rpNeedsRedeal, rpPairOptions } from '@shared/rules/redpoints';
import { createDeck, shuffleDeck } from '../../src/engine/deck';
import * as redpoints from '../../src/managers/games/redpoints-game';
import { isRuntimeSnapshot } from '../../src/runtime/validate';
import type { RuntimeSnapshot } from '../../src/runtime/types';

const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];
const CODE = 'ABC123';
const PLAYERS: Record<Seat, PlayerInfo> = {
  N: player('north'), E: player('east'), S: player('south'), W: player('west'),
};

function player(id: string): PlayerInfo {
  return { id, username: id, nickname: id, color: '#123456', avatar: 'cat', avatarImage: null };
}

function card(suit: Card['suit'], rank: Card['rank']): Card {
  return { suit, rank };
}

const same = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank;

/** Deck layout: N, E, S, W hands (6 each), 4 table cards, then the stock top-first; unset slots are filled in order. */
function deckWith(hands: Partial<Record<Seat, Card[]>>, table: Card[], stock: Card[]): Card[] {
  const slots: (Card | null)[] = Array.from({ length: 52 }, () => null);
  SEATS.forEach((seat, index) => (hands[seat] ?? []).forEach((entry, offset) => { slots[index * 6 + offset] = entry; }));
  table.forEach((entry, offset) => { slots[24 + offset] = entry; });
  stock.forEach((entry, offset) => { slots[28 + offset] = entry; });
  const rest = createDeck().filter((entry) => !slots.some((slot) => slot && same(slot, entry)));
  return slots.map((slot) => slot ?? rest.shift()!);
}

function game(): RedPointsGameState {
  const state = redpoints.getGameState(CODE);
  if (!state) throw new Error('Expected a Red Points game');
  return state;
}

/** The game wrapped in a minimal persisted table, as the coordinator would save it. */
function persists(): boolean {
  const state = game();
  const playing = state.phase === 'playing';
  const snapshot: RuntimeSnapshot = {
    players: SEATS.map((seat) => ({ info: PLAYERS[seat], currentRoomCode: CODE, disconnectedAt: null })),
    rooms: [{
      info: {
        code: CODE, gameType: 'redpoints', status: playing ? 'playing' : 'waiting', createdAt: 1,
        hostId: 'north', abortVote: null, abortVoteCooldownUntil: null,
        seats: { N: { player: PLAYERS.N, isReady: playing }, E: { player: PLAYERS.E, isReady: playing },
          S: { player: PLAYERS.S, isReady: playing }, W: { player: PLAYERS.W, isReady: playing } },
      },
      memberIds: SEATS.map((seat) => PLAYERS[seat].id),
    }],
    games: [structuredClone(state)],
    chat: [{ roomCode: CODE, messages: [] }],
  };
  return isRuntimeSnapshot(snapshot);
}

describe('Red Points gameplay', () => {
  beforeEach(() => redpoints.restoreGames([]));

  it('should validate captures, auto-capture a single flip match and leave unmatched flips', () => {
    const deck = deckWith(
      { N: [card('hearts', 14), card('spades', 5)], W: [card('clubs', 14)] },
      [card('clubs', 9), card('diamonds', 9), card('spades', 13), card('hearts', 2)],
      [card('clubs', 13), card('diamonds', 3)],
    );
    redpoints.startGame(CODE, PLAYERS, deck, 'N');
    expect(game()).toMatchObject({ phase: 'playing', currentTurnSeat: 'N', step: 'play', pendingFlip: null });
    expect(game().stock).toHaveLength(24);
    expect(persists()).toBe(true);

    expect(redpoints.play(CODE, 'E', card('hearts', 14))).toEqual({ success: false, reason: 'Not your turn' });
    expect(redpoints.play(CODE, 'N', card('hearts', 14))).toEqual({ success: false, reason: 'Choose a card to capture' });
    expect(redpoints.play(CODE, 'N', card('hearts', 14), card('spades', 13)))
      .toEqual({ success: false, reason: 'Cannot capture that card' });
    expect(redpoints.play(CODE, 'N', card('spades', 5), card('clubs', 9)))
      .toEqual({ success: false, reason: 'Nothing to capture' });
    expect(redpoints.play(CODE, 'N', card('clubs', 14))).toEqual({ success: false, reason: 'Card not in hand' });

    expect(redpoints.play(CODE, 'N', card('hearts', 14), card('diamonds', 9))).toEqual({ success: true });
    // The flipped ♣K pairs only with ♠K: captured automatically.
    expect(game().captured.N).toEqual([card('hearts', 14), card('diamonds', 9), card('clubs', 13), card('spades', 13)]);
    expect(game()).toMatchObject({ currentTurnSeat: 'W', table: [card('clubs', 9), card('hearts', 2)] });
    expect(game().log.map((entry) => entry.type)).toEqual(['play', 'flip']);
    expect(persists()).toBe(true);

    // A single option may be omitted; the flipped ♦3 has no match and stays.
    expect(redpoints.play(CODE, 'W', card('clubs', 14))).toEqual({ success: true });
    expect(game().captured.W).toEqual([card('clubs', 14), card('clubs', 9)]);
    expect(game()).toMatchObject({ currentTurnSeat: 'S', table: [card('hearts', 2), card('diamonds', 3)] });
    expect(game().log.at(-1)).toMatchObject({ type: 'flip', seat: 'W', card: card('diamonds', 3), captured: null });
    expect(persists()).toBe(true);
  });

  it('should wait for a choice when the flipped card has several matches', () => {
    const deck = deckWith(
      { S: [card('spades', 6)] },
      [card('hearts', 2), card('spades', 2), card('diamonds', 13), card('clubs', 10)],
      [card('clubs', 8)],
    );
    redpoints.startGame(CODE, PLAYERS, deck, 'S');
    expect(redpoints.play(CODE, 'S', card('spades', 6))).toEqual({ success: true });
    expect(game()).toMatchObject({ step: 'flip-choose', pendingFlip: card('clubs', 8), currentTurnSeat: 'S' });
    expect(game().log).toHaveLength(1);
    expect(redpoints.getPlayerVisibleState(CODE, 'N')).toMatchObject({ stockCount: 23, pendingFlip: card('clubs', 8) });
    expect(persists()).toBe(true);

    const hand = game().hands.S[0];
    expect(redpoints.play(CODE, 'S', hand)).toMatchObject({ success: false });
    expect(redpoints.chooseFlip(CODE, 'E', card('spades', 2))).toEqual({ success: false, reason: 'Not your turn' });
    expect(redpoints.chooseFlip(CODE, 'S', card('diamonds', 13))).toEqual({ success: false, reason: 'Cannot capture that card' });
    expect(redpoints.chooseFlip(CODE, 'S', card('spades', 2))).toEqual({ success: true });
    expect(game()).toMatchObject({ step: 'play', pendingFlip: null, currentTurnSeat: 'E' });
    expect(game().captured.S).toEqual([card('clubs', 8), card('spades', 2)]);
    expect(game().log.at(-1)).toMatchObject({ type: 'flip', seat: 'S', captured: card('spades', 2) });
    expect(redpoints.chooseFlip(CODE, 'E', card('hearts', 2))).toMatchObject({ success: false });
    expect(persists()).toBe(true);
  });

  it('should redeal when three table cards share a rank', () => {
    const deck = deckWith({}, [card('clubs', 7), card('hearts', 7), card('spades', 7), card('clubs', 2)], []);
    redpoints.startGame(CODE, PLAYERS, deck, 'N');
    expect(rpNeedsRedeal(game().table)).toBe(false);
    expect(game().table).toHaveLength(4);
    expect(persists()).toBe(true);
  });

  it('should play a whole game to scoring with every red point taken', () => {
    redpoints.startGame(CODE, PLAYERS, shuffleDeck(createDeck()));
    for (let moves = 0; game().phase === 'playing' && moves < 100; moves += 1) {
      const state = game();
      const seat = state.currentTurnSeat;
      if (state.step === 'flip-choose') {
        expect(redpoints.chooseFlip(CODE, seat, rpPairOptions(state.pendingFlip!, state.table)[0])).toEqual({ success: true });
      } else {
        const played = state.hands[seat][0];
        expect(redpoints.play(CODE, seat, played, rpPairOptions(played, state.table)[0])).toEqual({ success: true });
      }
      expect(persists()).toBe(true);
    }
    const { result, table, stock } = game();
    expect(game().phase).toBe('scoring');
    expect(table).toEqual([]);
    expect(stock).toEqual([]);
    if (!result) throw new Error('Expected a result');
    expect(SEATS.reduce((sum, seat) => sum + result.points[seat], 0)).toBe(208);
    const best = Math.max(...SEATS.map((seat) => result.points[seat]));
    expect(result.winners).toEqual(SEATS.filter((seat) => result.points[seat] === best));
    expect(redpoints.play(CODE, game().currentTurnSeat, card('clubs', 2))).toMatchObject({ success: false });
  });

  it('should reject an incoherent persisted game', () => {
    redpoints.startGame(CODE, PLAYERS, shuffleDeck(createDeck()));
    game().hands.N.pop();
    expect(persists()).toBe(false);
    redpoints.startGame(CODE, PLAYERS, shuffleDeck(createDeck()));
    game().step = 'flip-choose';
    expect(persists()).toBe(false);
  });
});

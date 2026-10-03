import { beforeEach, describe, expect, it } from 'vitest';
import type { Card, NinetyNineGameState, PlayerInfo, Seat } from '@shared/types';
import { nnApply, nnIsPlayable, nnRequiresChoice } from '@shared/rules/ninetynine';
import type { NnChoice } from '@shared/rules/ninetynine';
import { createDeck, shuffleDeck } from '../../src/engine/deck';
import * as ninetynine from '../../src/managers/games/ninetynine-game';
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

/** Deck layout: N, E, S, W hands (5 each), then the stock top-first; unset slots are filled in order. */
function deckWith(hands: Partial<Record<Seat, Card[]>>, stock: Card[] = []): Card[] {
  const slots: (Card | null)[] = Array.from({ length: 52 }, () => null);
  SEATS.forEach((seat, index) => (hands[seat] ?? []).forEach((entry, offset) => { slots[index * 5 + offset] = entry; }));
  stock.forEach((entry, offset) => { slots[20 + offset] = entry; });
  const rest = createDeck().filter((entry) => !slots.some((slot) => slot && same(slot, entry)));
  return slots.map((slot) => slot ?? rest.shift()!);
}

function game(): NinetyNineGameState {
  const state = ninetynine.getGameState(CODE);
  if (!state) throw new Error('Expected a 99 game');
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
        code: CODE, gameType: 'ninetynine', status: playing ? 'playing' : 'waiting', createdAt: 1,
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

describe('Ninety-Nine gameplay', () => {
  beforeEach(() => ninetynine.restoreGames([]));

  it('should validate plays and draw back to five cards', () => {
    const deck = deckWith({ N: [card('hearts', 10), card('clubs', 12), card('spades', 5), card('clubs', 2), card('hearts', 3)] });
    ninetynine.startGame(CODE, PLAYERS, deck, 'N');
    expect(game()).toMatchObject({ phase: 'playing', currentTurnSeat: 'N', total: 0, direction: 'ccw' });
    expect(game().stock).toHaveLength(32);
    expect(persists()).toBe(true);

    expect(ninetynine.play(CODE, 'E', card('clubs', 2))).toEqual({ success: false, reason: 'Not your turn' });
    expect(ninetynine.play(CODE, 'N', card('diamonds', 2))).toEqual({ success: false, reason: 'Card not in hand' });
    expect(ninetynine.play(CODE, 'N', card('hearts', 10))).toEqual({ success: false, reason: 'Choose plus or minus' });
    expect(ninetynine.play(CODE, 'N', card('clubs', 2), 'plus')).toEqual({ success: false, reason: 'This card takes no choice' });
    expect(ninetynine.play(CODE, 'N', card('spades', 5))).toEqual({ success: false, reason: 'Choose the next player' });
    expect(ninetynine.play(CODE, 'N', card('spades', 5), undefined, 'N')).toEqual({ success: false, reason: 'Invalid target' });
    expect(ninetynine.play(CODE, 'N', card('clubs', 2), undefined, 'S')).toEqual({ success: false, reason: 'This card takes no target' });

    expect(ninetynine.play(CODE, 'N', card('hearts', 10), 'minus')).toEqual({ success: true });
    expect(game().total).toBe(0);
    expect(game().hands.N).toHaveLength(5);
    expect(game().stock).toHaveLength(31);
    // Counter-clockwise from N is W.
    expect(game().currentTurnSeat).toBe('W');
    expect(game().log.at(-1)).toMatchObject({ type: 'play', seat: 'N', choice: 'minus', target: null, total: 0 });
    expect(ninetynine.getPlayerVisibleState(CODE, 'E')).toMatchObject({ lastPlayed: card('hearts', 10), stockCount: 31 });
    expect(ninetynine.getPlayerVisibleState(CODE, 'E')).not.toHaveProperty('stock');
    expect(persists()).toBe(true);
  });

  it('should reverse on 4, pass on J and designate on 5', () => {
    const deck = deckWith({
      N: [card('hearts', 4)], E: [card('clubs', 11)], S: [card('spades', 5)], W: [card('clubs', 2)],
    });
    ninetynine.startGame(CODE, PLAYERS, deck, 'N');
    expect(ninetynine.play(CODE, 'N', card('hearts', 4))).toEqual({ success: true });
    expect(game()).toMatchObject({ direction: 'cw', currentTurnSeat: 'E', total: 0 });
    // J = PASS: total unchanged, play moves on to the next seat (S) as normal.
    expect(ninetynine.play(CODE, 'E', card('clubs', 11))).toEqual({ success: true });
    expect(game()).toMatchObject({ currentTurnSeat: 'S', total: 0 });
    expect(persists()).toBe(true);

    expect(ninetynine.play(CODE, 'S', card('spades', 5), undefined, 'E')).toEqual({ success: true });
    expect(game()).toMatchObject({ currentTurnSeat: 'E', total: 0, direction: 'cw' });
    expect(game().log.at(-1)).toMatchObject({ type: 'play', seat: 'S', target: 'E' });
    expect(persists()).toBe(true);
  });

  it('should eliminate a seat that cannot play when the turn lands on it', () => {
    const busted = [card('clubs', 9), card('hearts', 8), card('diamonds', 7), card('clubs', 6), card('diamonds', 9)];
    const deck = deckWith({ N: [card('spades', 13)], W: busted, S: [card('spades', 4)] });
    ninetynine.startGame(CODE, PLAYERS, deck, 'N');
    expect(ninetynine.play(CODE, 'N', card('spades', 13))).toEqual({ success: true });
    expect(game()).toMatchObject({ total: 99, eliminated: ['W'], currentTurnSeat: 'S', phase: 'playing' });
    expect(game().hands.W).toEqual([]);
    // The busted hand lies under the K, which stays the last played card.
    expect(game().discard).toEqual([...busted, card('spades', 13)]);
    expect(game().log.at(-1)).toMatchObject({ type: 'eliminated', seat: 'W' });
    expect(ninetynine.play(CODE, 'W', busted[0])).toEqual({ success: false, reason: 'Not your turn' });
    expect(persists()).toBe(true);

    // Turn order now skips W.
    expect(ninetynine.play(CODE, 'S', card('spades', 4))).toEqual({ success: true });
    expect(game().direction).toBe('cw');
    expect(['N', 'E', 'S']).toContain(game().currentTurnSeat);
    expect(persists()).toBe(true);
  });

  it('should reshuffle the discard pile except its top card when the stock runs out', () => {
    const deck = deckWith({ N: [card('clubs', 2)], W: [card('clubs', 3)] });
    ninetynine.startGame(CODE, PLAYERS, deck, 'N');
    expect(ninetynine.play(CODE, 'N', card('clubs', 2))).toEqual({ success: true });
    const state = game();
    state.discard = [...state.stock, ...state.discard];
    state.stock = [];
    expect(persists()).toBe(true);

    expect(ninetynine.play(CODE, 'W', card('clubs', 3))).toEqual({ success: true });
    expect(game().discard).toEqual([card('clubs', 3)]);
    expect(game().stock).toHaveLength(31);
    expect(game().stock).toContainEqual(card('clubs', 2));
    expect(game().hands.W).toHaveLength(5);
    expect(persists()).toBe(true);
  });

  it('should play a whole game to a single winner', () => {
    ninetynine.startGame(CODE, PLAYERS, shuffleDeck(createDeck()));
    for (let moves = 0; game().phase === 'playing' && moves < 2000; moves += 1) {
      const state = game();
      const seat = state.currentTurnSeat;
      // Highest reachable total, to bust players quickly.
      const options = state.hands[seat].filter((entry) => nnIsPlayable(state.total, entry)).flatMap((entry) =>
        (nnRequiresChoice(entry) ? ['plus', 'minus'] as NnChoice[] : [undefined])
          .map((choice) => ({ entry, choice, total: nnApply(state.total, entry, choice).total }))
          .filter((option) => option.total <= 99));
      const best = options.reduce((top, option) => (option.total > top.total ? option : top));
      const target = best.entry.rank === 5
        ? SEATS.find((other) => other !== seat && !state.eliminated.includes(other)) : undefined;
      expect(ninetynine.play(CODE, seat, best.entry, best.choice, target)).toEqual({ success: true });
      expect(persists()).toBe(true);
    }
    const { result, eliminated } = game();
    expect(game().phase).toBe('scoring');
    if (!result) throw new Error('Expected a result');
    expect(eliminated).toHaveLength(3);
    expect(result.eliminationOrder).toEqual(eliminated);
    expect(eliminated).not.toContain(result.winnerSeat);
    expect(result.finalTotal).toBe(game().total);
    expect(ninetynine.play(CODE, result.winnerSeat, game().hands[result.winnerSeat][0])).toMatchObject({ success: false });
  });

  it('should reject an incoherent persisted game', () => {
    ninetynine.startGame(CODE, PLAYERS, shuffleDeck(createDeck()));
    game().hands.N.pop();
    expect(persists()).toBe(false);
    ninetynine.startGame(CODE, PLAYERS, shuffleDeck(createDeck()));
    game().eliminated.push('E');
    expect(persists()).toBe(false);
  });
});

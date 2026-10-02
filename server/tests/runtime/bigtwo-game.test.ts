import { beforeEach, describe, expect, it } from 'vitest';
import type { BigTwoGameState, Card, PlayerInfo, Seat } from '@shared/types';
import { sortBigTwoHand } from '@shared/rules/bigtwo';
import { createDeck } from '../../src/engine/deck';
import * as bigtwo from '../../src/managers/games/bigtwo-game';
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

/** Interleaves hands so dealCards hands them back to N, E, S, W. */
function deckFor(hands: Card[][]): Card[] {
  return Array.from({ length: 52 }, (_, index) => hands[index % 4][Math.floor(index / 4)]);
}

/** Ordered deck sliced 13 each: N 3333 4444 5555 ♣6, …, W ♠Q KKKK AAAA 2222. */
function orderedDeck(): Card[] {
  const sorted = sortBigTwoHand(createDeck());
  return deckFor(SEATS.map((_, index) => sorted.slice(index * 13, index * 13 + 13)));
}

function game(): BigTwoGameState {
  const state = bigtwo.getGameState(CODE);
  if (!state) throw new Error('Expected a Big Two game');
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
        code: CODE, gameType: 'bigtwo', status: playing ? 'playing' : 'waiting', createdAt: 1,
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

describe('Big Two gameplay', () => {
  beforeEach(() => bigtwo.restoreGames([]));

  it('should start with the club three holder, who must lead it', () => {
    bigtwo.startGame(CODE, PLAYERS, orderedDeck());
    expect(game()).toMatchObject({ phase: 'playing', currentTurnSeat: 'N', firstPlay: true, lastPlay: null });
    expect(persists()).toBe(true);
    expect(bigtwo.play(CODE, 'W', [card('spades', 2)])).toMatchObject({ success: false });
    expect(bigtwo.play(CODE, 'N', [card('diamonds', 3)])).toMatchObject({ success: false });
    expect(bigtwo.play(CODE, 'N', [card('spades', 2)])).toEqual({ success: false, reason: 'Card not in hand' });
    expect(bigtwo.play(CODE, 'N', [card('clubs', 3), card('diamonds', 3)])).toEqual({ success: true });
    expect(game()).toMatchObject({
      firstPlay: false, currentTurnSeat: 'W', lastPlay: { seat: 'N', comboType: 'pair' },
    });
    expect(game().hands.N).toHaveLength(11);
    expect(persists()).toBe(true);
  });

  it('should reject a pass on a free lead', () => {
    bigtwo.startGame(CODE, PLAYERS, orderedDeck());
    expect(bigtwo.pass(CODE, 'N')).toEqual({ success: false, reason: 'You must lead this round' });
  });

  it('should go counter-clockwise, lock passed seats and give the lead back after a round', () => {
    bigtwo.startGame(CODE, PLAYERS, orderedDeck());
    expect(bigtwo.play(CODE, 'N', [card('clubs', 3)]).success).toBe(true);
    expect(game().currentTurnSeat).toBe('W');
    expect(bigtwo.pass(CODE, 'W').success).toBe(true);
    expect(game()).toMatchObject({ currentTurnSeat: 'S', lockedSeats: ['W'] });
    expect(bigtwo.play(CODE, 'S', [card('hearts', 9)]).success).toBe(true);
    expect(game().currentTurnSeat).toBe('E');
    expect(persists()).toBe(true);
    expect(bigtwo.pass(CODE, 'E').success).toBe(true);
    expect(game().currentTurnSeat).toBe('N');
    expect(bigtwo.play(CODE, 'W', [card('spades', 2)])).toMatchObject({ success: false });
    expect(bigtwo.pass(CODE, 'N').success).toBe(true);
    // W is locked, so the turn returns to S: round over, everyone unlocked.
    expect(game()).toMatchObject({ currentTurnSeat: 'S', lastPlay: null, lockedSeats: [] });
    expect(game().log.at(-1)).toMatchObject({ type: 'round_end', leaderSeat: 'S' });
    expect(persists()).toBe(true);
    expect(bigtwo.play(CODE, 'S', [card('clubs', 10), card('diamonds', 10)]).success).toBe(true);
    expect(game().currentTurnSeat).toBe('E');
  });

  it('should beat anything with a bomb', () => {
    bigtwo.startGame(CODE, PLAYERS, orderedDeck());
    bigtwo.play(CODE, 'N', [card('clubs', 3)]);
    expect(bigtwo.play(CODE, 'W', [card('spades', 2)]).success).toBe(true);
    const bomb = [card('clubs', 10), card('diamonds', 10), card('hearts', 10), card('spades', 10), card('spades', 9)];
    expect(bigtwo.play(CODE, 'S', bomb)).toEqual({ success: true });
    expect(game().lastPlay?.comboType).toBe('fourOfAKind');
  });

  it('should end the game when the last card is played and charge the losers', () => {
    const deck = orderedDeck();
    bigtwo.startGame(CODE, PLAYERS, deck);
    const state = game();
    // N already played the rest of their hand as singles; the ♣3 is the last card.
    const extra = state.hands.N.filter((entry) => !(entry.suit === 'clubs' && entry.rank === 3));
    state.hands.N = [card('clubs', 3)];
    state.log.push(...extra.map((entry, index) => ({
      type: 'play' as const, seat: 'N' as Seat, cards: [entry], comboType: 'single' as const, timestamp: index,
    })));
    state.firstPlay = false;
    bigtwo.restoreGames([state]);
    expect(bigtwo.play(CODE, 'N', [card('clubs', 3)])).toEqual({ success: true });
    expect(game()).toMatchObject({
      phase: 'scoring',
      result: {
        gameType: 'bigtwo', winnerSeat: 'N', dragon: false,
        cardsLeft: { N: 0, E: 13, S: 13, W: 13 }, twosLeft: { N: 0, E: 0, S: 0, W: 4 },
        scores: { N: 0, E: 13, S: 13, W: 13 * 16 },
      },
    });
    expect(bigtwo.getPlayerVisibleState(CODE, 'E')?.revealedHands?.W).toHaveLength(13);
    expect(persists()).toBe(true);
    expect(bigtwo.pass(CODE, 'W')).toMatchObject({ success: false });
  });

  it('should win instantly with a dragon', () => {
    const rest = sortBigTwoHand(createDeck().filter((entry) => entry.suit !== 'clubs'));
    const clubs = createDeck().filter((entry) => entry.suit === 'clubs');
    bigtwo.startGame(CODE, PLAYERS, deckFor([clubs, rest.slice(0, 13), rest.slice(13, 26), rest.slice(26)]));
    expect(game()).toMatchObject({
      phase: 'scoring', currentTurnSeat: 'N',
      result: { winnerSeat: 'N', dragon: true, scores: { N: 0, E: 13, S: 13, W: 13 * 8 } },
    });
    expect(game().log).toEqual([expect.objectContaining({ type: 'dragon', seat: 'N' })]);
    expect(persists()).toBe(true);
    expect(bigtwo.play(CODE, 'N', [card('clubs', 3)])).toMatchObject({ success: false });
  });

  it('should reject an incoherent persisted game', () => {
    bigtwo.startGame(CODE, PLAYERS, orderedDeck());
    game().lockedSeats = ['E'];
    expect(persists()).toBe(false);
    bigtwo.startGame(CODE, PLAYERS, orderedDeck());
    game().hands.N.pop();
    expect(persists()).toBe(false);
  });
});

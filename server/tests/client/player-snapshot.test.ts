import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountProfile, PlayerInfo, PlayerSnapshot } from '@shared/types';

vi.mock('../../../client/src/socket', () => ({ disconnectSocket: vi.fn() }));
vi.mock('../../../client/src/api', () => ({
  apiRequest: vi.fn(),
  invalidateAccountRequests: vi.fn(),
}));

import { applyPlayerSnapshot } from '../../../client/src/stores/player-snapshot';
import { clearAccount, useAccountStore } from '../../../client/src/stores/account-store';
import { usePlayerStore } from '../../../client/src/stores/player-store';
import { useRoomStore } from '../../../client/src/stores/room-store';
import { useGameStore } from '../../../client/src/stores/game-store';
import { useChatStore } from '../../../client/src/stores/chat-store';
import { equalSnapshotValue } from '../../../client/src/stores/snapshot-equality';

const player: PlayerInfo = {
  id: 'alice', username: 'alice', nickname: 'Alice', avatar: 'cat', avatarImage: null,
  color: '#4a9eff',
};
const account: AccountProfile = { ...player, createdAt: 100, updatedAt: 200 };
const snapshot: PlayerSnapshot = {
  success: true,
  player,
  room: {
    code: 'ABC123', gameType: 'bridge', status: 'playing', createdAt: 123,
    seats: {
      N: { player, isReady: true }, E: { player: null, isReady: false },
      S: { player: null, isReady: false }, W: { player: null, isReady: false },
    },
  },
  gameState: {
    phase: 'playing', mySeat: 'N', dealerSeat: 'N',
    myHand: [{ suit: 'clubs', rank: 2 }, { suit: 'spades', rank: 14 }],
    validCards: [{ suit: 'clubs', rank: 2 }],
    bidding: null, contract: { level: 1, suit: 'clubs', declarer: 'N' },
    playing: {
      currentTrick: { W: { suit: 'clubs', rank: 10 } }, trickLeadSeat: 'W',
      currentTurnSeat: 'N', completedTricks: [], trickCountEW: 0, trickCountNS: 0,
    },
    result: null, log: [{ type: 'system', message: 'Started', timestamp: 123 }],
    redealPendingSeat: null,
  },
  chatHistory: [{ id: 'first', sender: player, content: 'Hello', timestamp: 123 }],
};

const unsubscribe: (() => void)[] = [];

function observeStores(): Record<'account' | 'player' | 'room' | 'game' | 'chat', number> {
  const notifications = { account: 0, player: 0, room: 0, game: 0, chat: 0 };
  unsubscribe.push(
    useAccountStore.subscribe(() => { notifications.account += 1; }),
    usePlayerStore.subscribe(() => { notifications.player += 1; }),
    useRoomStore.subscribe(() => { notifications.room += 1; }),
    useGameStore.subscribe(() => { notifications.game += 1; }),
    useChatStore.subscribe(() => { notifications.chat += 1; }),
  );
  return notifications;
}

describe('client authoritative snapshot updates', () => {
  beforeEach(() => {
    clearAccount();
    useAccountStore.getState().setAccount(structuredClone(account));
    applyPlayerSnapshot(structuredClone(snapshot));
  });

  afterEach(() => {
    unsubscribe.splice(0).forEach((stop) => stop());
  });

  it('should restore the complete visible game, membership, profile, and chat', () => {
    expect(usePlayerStore.getState().player).toEqual(player);
    expect(useAccountStore.getState().account).toEqual(account);
    expect(useAccountStore.getState().connection).toBe('ready');
    expect(useRoomStore.getState()).toMatchObject({
      currentRoomCode: 'ABC123', roomInfo: snapshot.room, mySeat: 'N',
    });
    const { mySeat: _mySeat, ...game } = snapshot.gameState!;
    expect(useGameStore.getState()).toMatchObject({ ...game, currentTurnSeat: 'N' });
    expect(useChatStore.getState().messages).toEqual(snapshot.chatHistory);
  });

  it('should publish no store notifications for 100 equivalent wire snapshots', () => {
    const notifications = observeStores();
    const previousGame = useGameStore.getState();
    for (let i = 0; i < 100; i += 1) applyPlayerSnapshot(structuredClone(snapshot));
    expect(notifications).toEqual({ account: 0, player: 0, room: 0, game: 0, chat: 0 });
    expect(useGameStore.getState()).toBe(previousGame);
  });

  it('should update only chat when a chat message arrives during play', () => {
    const notifications = observeStores();
    const room = useRoomStore.getState().roomInfo;
    const game = useGameStore.getState();
    const next = structuredClone(snapshot);
    next.chatHistory!.push({ id: 'second', sender: player, content: 'Your turn', timestamp: 456 });
    applyPlayerSnapshot(next);
    expect(notifications).toEqual({ account: 0, player: 0, room: 0, game: 0, chat: 1 });
    expect(useRoomStore.getState().roomInfo).toBe(room);
    expect(useGameStore.getState()).toBe(game);
    expect(useChatStore.getState().messages).toEqual(next.chatHistory);
  });

  it('should retain untouched game branches while immediately updating turn and valid cards', () => {
    const notifications = observeStores();
    const previous = useGameStore.getState();
    applyPlayerSnapshot({
      ...structuredClone(snapshot),
      gameState: {
        ...structuredClone(snapshot.gameState!),
        playing: { ...snapshot.gameState!.playing!, currentTurnSeat: 'E' },
        validCards: [{ suit: 'spades', rank: 14 }],
      },
    });
    const current = useGameStore.getState();
    expect(current.currentTurnSeat).toBe('E');
    expect(current.validCards).toEqual([{ suit: 'spades', rank: 14 }]);
    expect(current.myHand).toBe(previous.myHand);
    expect(current.log).toBe(previous.log);
    expect(current.contract).toBe(previous.contract);
    expect(notifications).toEqual({ account: 0, player: 0, room: 0, game: 1, chat: 0 });
  });

  it('should preserve ready, seat, and profile changes instead of comparing only ids', () => {
    const changedPlayer: PlayerInfo = { ...player, nickname: 'New name', avatar: 'fox' };
    applyPlayerSnapshot({
      ...structuredClone(snapshot), player: changedPlayer,
      room: {
        ...snapshot.room!,
        seats: {
          ...snapshot.room!.seats, N: { player: null, isReady: false },
          E: { player: changedPlayer, isReady: false },
        },
      },
      chatHistory: [{ ...snapshot.chatHistory![0], sender: changedPlayer, content: 'Edited' }],
    });
    expect(useRoomStore.getState().mySeat).toBe('E');
    expect(useRoomStore.getState().roomInfo?.seats.E.isReady).toBe(false);
    expect(useAccountStore.getState().account).toEqual({ ...account, ...changedPlayer });
    expect(usePlayerStore.getState().player).toEqual(changedPlayer);
    expect(useChatStore.getState().messages[0].content).toBe('Edited');
    expect(useChatStore.getState().messages[0].sender.avatar).toBe('fox');
  });

  it('should clear omitted room, game, and chat authoritatively and make repeat clears a no-op', () => {
    applyPlayerSnapshot({ success: true, player: structuredClone(player) });
    expect(useRoomStore.getState()).toMatchObject({
      currentRoomCode: null, roomInfo: null, mySeat: null,
    });
    expect(useGameStore.getState()).toMatchObject({
      phase: null, myHand: [], validCards: [], log: [], playing: null, contract: null,
      bidding: null, result: null, currentTurnSeat: null, redealPendingSeat: null,
    });
    expect(useChatStore.getState().messages).toEqual([]);
    const notifications = observeStores();
    applyPlayerSnapshot({ success: true, player: structuredClone(player) });
    expect(Object.values(notifications).every((count) => count === 0)).toBe(true);
  });

  it('should ignore failed, incomplete, and previous-account snapshots', () => {
    const notifications = observeStores();
    applyPlayerSnapshot({ success: false, error: 'Unavailable' });
    applyPlayerSnapshot({ success: true });
    applyPlayerSnapshot({ success: true, player: { ...player, id: 'previous-account' } });
    expect(Object.values(notifications).every((count) => count === 0)).toBe(true);
    expect(useAccountStore.getState().account?.id).toBe('alice');
    expect(useRoomStore.getState().currentRoomCode).toBe('ABC123');
  });

  it('should derive bidding turns and clear stale playing data at a new deal', () => {
    applyPlayerSnapshot({
      ...snapshot,
      gameState: {
        ...snapshot.gameState!, phase: 'bidding', validCards: [], playing: null, contract: null,
        bidding: {
          bids: [], currentBidderSeat: 'S', highestBid: null,
          consecutivePassCount: 0, isFirstRound: true,
        },
        log: [],
      },
    });
    expect(useGameStore.getState()).toMatchObject({
      phase: 'bidding', currentTurnSeat: 'S', playing: null, contract: null, validCards: [], log: [],
    });
  });
});

describe('serialized snapshot equality', () => {
  it('should ignore object key order but retain array order and distinguish missing values', () => {
    expect(equalSnapshotValue({ a: 1, b: [null, 'x'] }, { b: [null, 'x'], a: 1 })).toBe(true);
    expect(equalSnapshotValue([1, 2], [2, 1])).toBe(false);
    expect(equalSnapshotValue({}, { a: undefined })).toBe(false);
    expect(equalSnapshotValue([], {})).toBe(false);
    expect(equalSnapshotValue(null, {})).toBe(false);
    expect(equalSnapshotValue({ a: false }, { a: true })).toBe(false);
  });
});

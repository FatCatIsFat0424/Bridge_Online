import { isDeepStrictEqual } from 'node:util';
import { SEAT_ORDER_CLOCKWISE } from '@shared/constants';
import type { Repository, MatchRecord } from '../database/repository';
import type { RuntimeSnapshot } from './types';
import * as playerManager from '../managers/player-manager';
import * as roomManager from '../managers/room-manager';
import * as gameManager from '../managers/game-manager';
import * as chatManager from '../managers/chat-manager';

export interface RuntimeMutationOptions {
  skipUnchanged?: boolean;
  afterCommit?: () => void;
}

export interface RuntimeCoordinator {
  mutate: <T>(operation: () => T | Promise<T>, options?: RuntimeMutationOptions) => Promise<T>;
  /** Reads committed runtime state in queue order without saving it. */
  inspect: <T>(operation: () => T | Promise<T>) => Promise<T>;
  snapshot: () => RuntimeSnapshot;
  idle: () => Promise<void>;
}

function currentState(): RuntimeSnapshot {
  return {
    players: playerManager.exportPlayers(), rooms: roomManager.exportRooms(),
    games: gameManager.exportGames(), chat: chatManager.exportChat(),
  };
}

function snapshot(): RuntimeSnapshot {
  return structuredClone(currentState());
}

function restore(state: RuntimeSnapshot, restarting = false): void {
  playerManager.restorePlayers(state.players, restarting);
  roomManager.restoreRooms(state.rooms);
  gameManager.restoreGames(state.games);
  chatManager.restoreChat(state.chat);
}

/** Serializes game mutations and persists each before acknowledging or broadcasting it. */
export async function createRuntimeCoordinator(repository: Repository): Promise<RuntimeCoordinator> {
  const initial = await repository.loadRuntime();
  restore(initial ?? { players: [], rooms: [], games: [], chat: [] }, true);
  let queue = Promise.resolve();

  function mutate<T>(operation: () => T | Promise<T>, options: RuntimeMutationOptions = {}): Promise<T> {
    const result = queue.then(async (): Promise<T> => {
      const before = snapshot();
      let value: T;
      try {
        value = await operation();
        const matches: MatchRecord[] = [];
        for (const game of gameManager.exportGames()) {
          if (game.result && roomManager.getRoomInfo(game.roomCode)?.status === 'playing') {
            roomManager.setRoomStatus(game.roomCode, 'waiting');
            roomManager.resetAllReady(game.roomCode);
            matches.push({
              id: game.id, roomCode: game.roomCode,
              accountIds: SEAT_ORDER_CLOCKWISE.map((seat) => game.players[seat].id),
              result: game.gameType === 'bridge' ? { ...game.result, gameType: 'bridge' } : game.result,
              finishedAt: Date.now(),
            });
          }
        }
        const after = currentState();
        if (!options.skipUnchanged || matches.length > 0 || !isDeepStrictEqual(before, after)) {
          // Hold the runtime queue until the repository has copied and committed this view.
          // Only the rollback/public snapshots need a separate full deep clone here.
          await repository.saveRuntime(after, matches);
        }
      } catch (error) {
        restore(before);
        throw error;
      }
      // Notifications run only after durability is established, outside rollback handling.
      options.afterCommit?.();
      return value;
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function inspect<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  return { mutate, inspect, snapshot, idle: (): Promise<void> => queue };
}

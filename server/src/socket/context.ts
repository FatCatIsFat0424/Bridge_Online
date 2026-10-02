import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';
import type { PlayerSnapshot } from '@shared/types/socket-events';
import type { AuthService } from '../auth/auth-service';
import type { RuntimeCoordinator, RuntimeMutationOptions } from '../runtime/coordinator';
import type { VoiceManager } from '../managers/voice-manager';
import { reconcileVoiceMembership } from './voice-handler';
import * as playerManager from '../managers/player-manager';
import * as roomManager from '../managers/room-manager';
import * as gameManager from '../managers/game-manager';
import * as chatManager from '../managers/chat-manager';

export interface ConnectionData {
  accountId: string;
  tokenHash: string;
  cookie: string;
  expiresAt: number;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, ConnectionData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, ConnectionData>;

export interface ActionResponse extends PlayerSnapshot {
  roomCode?: string;
}

export interface SocketContext {
  io: TypedServer;
  runtime: RuntimeCoordinator;
  auth: AuthService;
  voice: VoiceManager;
}

export function actionError(message: string): Error & { publicMessage: string } {
  return Object.assign(new Error(message), { publicMessage: message });
}

export function requireSuccess(result: { success: boolean; reason?: string }): void {
  if (!result.success) throw actionError(result.reason ?? 'Unable to complete this action.');
}

export function playerSnapshot(accountId: string): PlayerSnapshot {
  const state = playerManager.getPlayerState(accountId);
  if (!state) return { success: false, error: 'Player is not connected.' };
  const room = state.currentRoomCode ? roomManager.getRoomInfo(state.currentRoomCode) : null;
  const seat = room ? roomManager.getPlayerSeat(room.code, accountId) : null;
  const gameState = room && seat ? gameManager.getPlayerVisibleState(room.code, seat) : null;
  return {
    success: true, player: state.info, room: room ?? undefined,
    gameState: gameState ?? undefined,
    chatHistory: room ? chatManager.getChatHistory(room.code) : [],
  };
}

export function affectedAccounts(accountId: string): Set<string> {
  const accounts = new Set([accountId]);
  const code = playerManager.getPlayerState(accountId)?.currentRoomCode;
  if (code) {
    for (const id of roomManager.getRoomMemberIds(code)) accounts.add(id);
  }
  return accounts;
}

export function broadcastState(io: TypedServer, accountIds: Iterable<string>): void {
  for (const accountId of new Set(accountIds)) {
    const channel = `account:${accountId}`;
    if (io.sockets.adapter.rooms.has(channel)) {
      io.to(channel).emit('player:state', playerSnapshot(accountId));
    }
  }
}

export function runAction(
  context: SocketContext,
  socket: TypedSocket,
  callback: (response: ActionResponse) => void,
  action: () => ActionResponse,
  options: RuntimeMutationOptions = {},
): void {
  if (typeof callback !== 'function') return;
  const recipients = new Set<string>();
  void context.runtime.mutate(async (): Promise<ActionResponse> => {
    const session = await context.auth.resolveSession(socket.data.cookie);
    if (!session || session.account.id !== socket.data.accountId || !socket.connected) {
      throw actionError('Your session has expired. Please sign in again.');
    }
    const info = playerManager.toPlayerInfo(session.account);
    if (!playerManager.getPlayerIdBySocketId(socket.id)) {
      playerManager.attachPlayer(socket.id, info);
    }
    for (const id of affectedAccounts(session.account.id)) recipients.add(id);
    playerManager.updatePlayerInfo(info);
    roomManager.updateRoomPlayer(info,
      playerManager.getPlayerState(session.account.id)?.currentRoomCode ?? null);
    const response = action();
    for (const id of affectedAccounts(session.account.id)) recipients.add(id);
    return response;
  }, { ...options, afterCommit: () => {
    reconcileVoiceMembership(context, recipients);
    options.afterCommit?.();
  } }).then((response) => {
    broadcastState(context.io, recipients);
    callback(response);
  }).catch((error: unknown) => {
    if (error instanceof Error && 'publicMessage' in error && typeof error.publicMessage === 'string') {
      callback({ success: false, error: error.publicMessage });
    } else {
      console.error('[socket] Failed to commit action:', error);
      callback({ success: false, error: 'Unable to save your changes. Please try again.' });
    }
  });
}

export function requireRoom(socket: TypedSocket): string {
  const state = playerManager.getPlayerState(socket.data.accountId);
  if (!state?.currentRoomCode) throw actionError('Join a room first.');
  return state.currentRoomCode;
}

export function leaveCurrentRoom(accountId: string): void {
  const code = playerManager.getPlayerState(accountId)?.currentRoomCode;
  if (!code) return;
  if (roomManager.getRoomInfo(code)?.status === 'playing') {
    gameManager.abortGame(code, 'A player left the game.');
    roomManager.setRoomStatus(code, 'waiting');
    roomManager.resetAllReady(code);
  }
  const { roomEmpty } = roomManager.leaveRoom(code, accountId);
  playerManager.setPlayerRoom(accountId, null);
  if (roomEmpty) {
    gameManager.removeGame(code);
    chatManager.clearRoomChat(code);
  }
}

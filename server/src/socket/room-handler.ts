import type { Seat } from '@shared/types';
import type { SocketContext, TypedSocket } from './context';
import { actionError, requireRoom, requireSuccess, runAction, leaveCurrentRoom } from './context';
import * as playerManager from '../managers/player-manager';
import * as roomManager from '../managers/room-manager';
import * as gameManager from '../managers/game-manager';
import * as chatManager from '../managers/chat-manager';

export function registerRoomHandlers(context: SocketContext, socket: TypedSocket): void {
  socket.on('room:create', (payload, callback) => runAction(context, socket, callback, () => {
    if (!payload || payload.gameType !== 'bridge') throw actionError('Unsupported game type.');
    const accountId = socket.data.accountId;
    if (playerManager.getPlayerState(accountId)?.currentRoomCode) throw actionError('Already in a room.');
    const roomCode = roomManager.createRoom('bridge', accountId);
    chatManager.initRoomChat(roomCode);
    playerManager.setPlayerRoom(accountId, roomCode);
    return { success: true, roomCode };
  }));

  socket.on('room:join', (payload, callback) => runAction(context, socket, callback, () => {
    if (!payload || typeof payload.roomCode !== 'string') throw actionError('Enter a room code.');
    const roomCode = payload.roomCode.trim().toUpperCase();
    const accountId = socket.data.accountId;
    const currentRoom = playerManager.getPlayerState(accountId)?.currentRoomCode;
    if (currentRoom && currentRoom !== roomCode) throw actionError('Leave your current room first.');
    requireSuccess(roomManager.joinRoom(roomCode, accountId));
    playerManager.setPlayerRoom(accountId, roomCode);
    return { success: true, room: roomManager.getRoomInfo(roomCode) ?? undefined };
  }));

  socket.on('room:leave', (callback) => runAction(context, socket, callback, () => {
    requireRoom(socket);
    leaveCurrentRoom(socket.data.accountId);
    return { success: true };
  }));

  socket.on('room:changeSeat', (payload, callback) => runAction(context, socket, callback, () => {
    if (!payload || !(['N', 'E', 'S', 'W'] as Seat[]).includes(payload.seat)) {
      throw actionError('Invalid seat.');
    }
    const player = playerManager.getPlayerInfo(socket.data.accountId);
    if (!player) throw actionError('Player not found.');
    requireSuccess(roomManager.changeSeat(requireRoom(socket), player, payload.seat));
    return { success: true };
  }));

  socket.on('room:ready', (callback) => runAction(context, socket, callback, () => {
    const code = requireRoom(socket);
    requireSuccess(roomManager.setReady(code, socket.data.accountId, true));
    if (roomManager.isAllReady(code)) {
      const players = roomManager.getSeatPlayers(code);
      if (!players) throw actionError('All four seats must be filled.');
      roomManager.setRoomStatus(code, 'playing');
      gameManager.startGame(code, players);
    }
    return { success: true };
  }));

  socket.on('room:unready', (callback) => runAction(context, socket, callback, () => {
    requireSuccess(roomManager.setReady(requireRoom(socket), socket.data.accountId, false));
    return { success: true };
  }));
}
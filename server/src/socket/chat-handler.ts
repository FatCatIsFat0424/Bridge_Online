import type { SocketContext, TypedSocket } from './context';
import { actionError, requireRoom, runAction } from './context';
import * as playerManager from '../managers/player-manager';
import * as chatManager from '../managers/chat-manager';

export function registerChatHandlers(context: SocketContext, socket: TypedSocket): void {
  socket.on('chat:send', (payload, callback) => runAction(context, socket, callback, () => {
    const content = payload?.message;
    if (typeof content !== 'string' || !content.trim() || content.trim().length > 500) {
      throw actionError('Messages must contain 1–500 characters.');
    }
    const player = playerManager.getPlayerInfo(socket.data.accountId);
    if (!player) throw actionError('Player not found.');
    chatManager.addMessage(requireRoom(socket), player, content.trim());
    return { success: true };
  }));
}
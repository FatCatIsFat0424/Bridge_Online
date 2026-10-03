import type { EmojiRecord } from '@shared/types';
import type { SocketContext, TypedSocket } from './context';
import { actionError, requireRoom, runAction } from './context';
import * as playerManager from '../managers/player-manager';
import * as chatManager from '../managers/chat-manager';

export function registerChatHandlers(context: SocketContext, socket: TypedSocket): void {
  socket.on('chat:send', (payload, callback) => {
    if (typeof callback !== 'function') return;
    // A library read failure only drops emoji images; the message itself still sends.
    void context.listEmojis(socket.data.accountId).catch((): EmojiRecord[] => [])
      .then((library) => runAction(context, socket, callback, () => {
        const content = payload?.message;
        if (typeof content !== 'string' || !content.trim() || content.trim().length > 500) {
          throw actionError('Messages must contain 1–500 characters.');
        }
        const player = playerManager.getPlayerInfo(socket.data.accountId);
        if (!player) throw actionError('Player not found.');
        chatManager.addMessage(requireRoom(socket), player, content.trim(), library);
        return { success: true };
      }));
  });
}

import { RECONNECT_TIMEOUT_MS } from '@shared/constants';
import type { AccountProfile } from '@shared/types';
import type { SocketContext } from './context';
import { affectedAccounts, broadcastState, leaveCurrentRoom, playerSnapshot, runAction } from './context';
import * as playerManager from '../managers/player-manager';
import * as roomManager from '../managers/room-manager';
import { registerRoomHandlers } from './room-handler';
import { registerGameHandlers } from './game-handler';
import { registerChatHandlers } from './chat-handler';
import { leaveVoice, reconcileVoiceMembership, registerVoiceHandlers } from './voice-handler';

export function setupConnectionHandler(context: SocketContext): () => void {
  const { io, auth, runtime } = context;
  let closing = false;
  io.use((socket, next) => {
    void auth.resolveSession(socket.handshake.headers.cookie).then((session) => {
      if (!session) { next(new Error('Sign in to play.')); return; }
      socket.data = {
        accountId: session.account.id, tokenHash: session.session.tokenHash,
        cookie: socket.handshake.headers.cookie ?? '', expiresAt: session.session.expiresAt,
      };
      next();
    }).catch(() => next(new Error('Unable to authenticate.')));
  });

  io.on('connection', (socket) => {
    void socket.join(`account:${socket.data.accountId}`);
    const expiry = setTimeout(() => socket.disconnect(true),
      Math.max(0, socket.data.expiresAt - Date.now()));
    expiry.unref();
    let count = 0;
    let voiceCount = 0;
    let resetAt = Date.now() + 60_000;
    socket.use((packet, next) => {
      if (Date.now() >= resetAt) { count = 0; voiceCount = 0; resetAt = Date.now() + 60_000; }
      const isVoice = typeof packet[0] === 'string' && packet[0].startsWith('voice:');
      if (isVoice) voiceCount += 1;
      else count += 1;
      if ((isVoice && voiceCount > 1200) || (!isVoice && count > 240)) {
        const callback: unknown = packet[packet.length - 1];
        if (typeof callback === 'function') callback({ success: false, error: 'Too many actions. Please slow down.' });
        return;
      }
      next();
    });

    registerRoomHandlers(context, socket);
    registerGameHandlers(context, socket);
    registerChatHandlers(context, socket);
    registerVoiceHandlers(context, socket);
    socket.on('player:resume', (callback) => runAction(context, socket, callback, () =>
      playerSnapshot(socket.data.accountId), { skipUnchanged: true }));

    socket.on('disconnect', () => {
      clearTimeout(expiry);
      if (closing) { context.voice.leave(socket.id); return; }
      leaveVoice(context, socket.id, 'Voice connection closed.');
      const recipients = new Set<string>();
      void runtime.mutate(() => {
        for (const id of affectedAccounts(socket.data.accountId)) recipients.add(id);
        playerManager.markDisconnected(socket.id);
      }, { skipUnchanged: true }).then(() => broadcastState(io, recipients))
        .catch((error: unknown) => console.error('[disconnect]', error));
    });
  });

  const cleanup = setInterval(() => {
    if (closing || playerManager.getExpiredPlayers(RECONNECT_TIMEOUT_MS).length === 0) return;
    const recipients = new Set<string>();
    void runtime.mutate(() => {
      for (const player of playerManager.getExpiredPlayers(RECONNECT_TIMEOUT_MS)) {
        for (const id of affectedAccounts(player.info.id)) recipients.add(id);
        leaveCurrentRoom(player.info.id);
        playerManager.removePlayer(player.info.id);
      }
    }, { skipUnchanged: true,
      afterCommit: () => reconcileVoiceMembership(context, recipients),
    }).then(() => broadcastState(io, recipients))
      .catch((error: unknown) => console.error('[cleanup]', error));
  }, 5_000);
  cleanup.unref();

  return (): void => {
    closing = true;
    clearInterval(cleanup);
  };
}

export async function updateConnectedProfile(
  context: SocketContext,
  account: AccountProfile,
): Promise<void> {
  const recipients = new Set<string>();
  const info = playerManager.toPlayerInfo(account);
  await context.runtime.mutate(() => {
    for (const id of affectedAccounts(account.id)) recipients.add(id);
    playerManager.updatePlayerInfo(info);
    roomManager.updateRoomPlayer(info,
      playerManager.getPlayerState(account.id)?.currentRoomCode ?? null);
  }, { skipUnchanged: true });
  broadcastState(context.io, recipients);
}

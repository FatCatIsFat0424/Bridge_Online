import type { VoiceCandidate, VoiceJoinResult, VoiceSettings, VoiceSignal } from '@shared/types';
import type { ActionResult } from '@shared/types/socket-events';
import type { VoicePeer } from '../managers/voice-manager';
import * as playerManager from '../managers/player-manager';
import * as roomManager from '../managers/room-manager';
import type { SocketContext, TypedSocket } from './context';

function voiceError(message: string): Error {
  return Object.assign(new Error(message), { publicMessage: message });
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function settingsValue(value: unknown): VoiceSettings {
  if (!object(value) || typeof value.muted !== 'boolean' || typeof value.deafened !== 'boolean') {
    throw voiceError('Invalid voice settings.');
  }
  return { muted: value.muted, deafened: value.deafened };
}

function nullableString(value: unknown, maximum: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maximum);
}

function signalValue(value: unknown): VoiceSignal {
  if (!object(value) || typeof value.targetPeerId !== 'string'
    || !/^[a-f\d-]{36}$/i.test(value.targetPeerId)
    || (value.description !== undefined) === (value.candidate !== undefined)) {
    throw voiceError('Invalid voice signal.');
  }
  if (value.description !== undefined) {
    const description = value.description;
    if (!object(description) || (description.type !== 'offer' && description.type !== 'answer')
      || typeof description.sdp !== 'string' || !description.sdp || description.sdp.length > 12_000) {
      throw voiceError('Invalid voice description.');
    }
    return { targetPeerId: value.targetPeerId, description: {
      type: description.type, sdp: description.sdp,
    } };
  }
  const candidate = value.candidate;
  if (!object(candidate) || typeof candidate.candidate !== 'string' || candidate.candidate.length > 2_048
    || !nullableString(candidate.sdpMid, 128)
    || !(candidate.sdpMLineIndex === null || (Number.isInteger(candidate.sdpMLineIndex)
      && Number(candidate.sdpMLineIndex) >= 0 && Number(candidate.sdpMLineIndex) <= 65_535))
    || !(candidate.usernameFragment === undefined || nullableString(candidate.usernameFragment, 256))) {
    throw voiceError('Invalid voice candidate.');
  }
  const safeCandidate: VoiceCandidate = {
    candidate: candidate.candidate, sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex as number | null,
    ...(candidate.usernameFragment !== undefined ? { usernameFragment: candidate.usernameFragment } : {}),
  };
  return { targetPeerId: value.targetPeerId, candidate: safeCandidate };
}

function currentRoom(accountId: string): string | null {
  const roomCode = playerManager.getPlayerState(accountId)?.currentRoomCode;
  return roomCode && roomManager.getRoomMemberIds(roomCode).includes(accountId) ? roomCode : null;
}

function broadcastVoice(context: SocketContext, roomCode: string): void {
  const state = context.voice.state(roomCode);
  for (const peer of context.voice.peers(roomCode)) {
    context.io.to(peer.socketId).emit('voice:state', state);
  }
}

export function leaveVoice(context: SocketContext, socketId: string, reason: string): void {
  const peer = context.voice.leave(socketId);
  if (!peer) return;
  context.io.to(socketId).emit('voice:left', { reason });
  broadcastVoice(context, peer.roomCode);
}

/** Called only after a successful durable room mutation, while its queue is still held. */
export function reconcileVoiceMembership(context: SocketContext, accountIds: Iterable<string>): void {
  for (const accountId of new Set(accountIds)) {
    const peer = context.voice.byAccount(accountId);
    if (peer && currentRoom(accountId) !== peer.roomCode) {
      leaveVoice(context, peer.socketId, 'You left the table.');
    }
  }
}

function joinedPeer(context: SocketContext, socket: TypedSocket): VoicePeer {
  const peer = context.voice.bySocket(socket.id);
  if (!peer || currentRoom(socket.data.accountId) !== peer.roomCode) {
    if (peer) leaveVoice(context, socket.id, 'You left the table.');
    throw voiceError('Join your table voice chat first.');
  }
  return peer;
}

export function registerVoiceHandlers(context: SocketContext, socket: TypedSocket): void {
  function run<T extends ActionResult>(callback: (result: T | ActionResult) => void,
    action: () => T | Promise<T>): void {
    if (typeof callback !== 'function') return;
    void context.runtime.inspect(async (): Promise<T> => {
      const session = await context.auth.resolveSession(socket.data.cookie);
      if (!session || session.account.id !== socket.data.accountId || !socket.connected) {
        leaveVoice(context, socket.id, 'Your session has expired.');
        throw voiceError('Your session has expired. Please sign in again.');
      }
      return action();
    }).then(callback).catch((error: unknown) => {
      const message = error instanceof Error && 'publicMessage' in error
        && typeof error.publicMessage === 'string' ? error.publicMessage : 'Voice chat is unavailable. Try again.';
      callback({ success: false, error: message });
    });
  }

  socket.on('voice:join', (payload, callback) => run<VoiceJoinResult>(callback, () => {
    const settings = settingsValue(payload);
    const roomCode = currentRoom(socket.data.accountId);
    if (!roomCode) throw voiceError('Join a table before joining voice chat.');
    const result = context.voice.join(socket.id, socket.data.accountId, roomCode, settings);
    if (!result.success) throw voiceError(result.error);
    broadcastVoice(context, roomCode);
    return { success: true, peerId: result.peer.peerId, state: context.voice.state(roomCode) };
  }));

  socket.on('voice:leave', (callback) => run(callback, () => {
    leaveVoice(context, socket.id, 'You left voice chat.');
    return { success: true };
  }));

  socket.on('voice:settings', (payload, callback) => run(callback, () => {
    const settings = settingsValue(payload);
    const peer = joinedPeer(context, socket);
    context.voice.settings(socket.id, settings);
    broadcastVoice(context, peer.roomCode);
    return { success: true };
  }));

  socket.on('voice:signal', (payload, callback) => run(callback, async (): Promise<ActionResult> => {
    const signal = signalValue(payload);
    const sender = joinedPeer(context, socket);
    const target = context.voice.byPeer(signal.targetPeerId);
    if (!target || target.peerId === sender.peerId || target.roomCode !== sender.roomCode
      || currentRoom(target.accountId) !== sender.roomCode) throw voiceError('Voice peer is unavailable.');
    const targetSocket = context.io.sockets.sockets.get(target.socketId);
    const targetSession = targetSocket ? await context.auth.resolveSession(targetSocket.data.cookie) : null;
    if (!targetSocket?.connected || !targetSession || targetSession.account.id !== target.accountId) {
      leaveVoice(context, target.socketId, 'Your session has expired.');
      throw voiceError('Voice peer is unavailable.');
    }
    if (!socket.connected || !context.voice.byPeer(sender.peerId)) throw voiceError('Voice peer is unavailable.');
    context.io.to(target.socketId).emit('voice:signal', {
      fromPeerId: sender.peerId,
      ...(signal.description ? { description: signal.description } : { candidate: signal.candidate }),
    });
    return { success: true };
  }));
}

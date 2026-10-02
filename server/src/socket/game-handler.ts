import type { Seat } from '@shared/types';
import type { SocketContext, TypedSocket } from './context';
import { actionError, requireRoom, requireSuccess, runAction } from './context';
import * as roomManager from '../managers/room-manager';
import * as gameManager from '../managers/game-manager';

function playerSeat(socket: TypedSocket, code: string): Seat {
  const seat = roomManager.getPlayerSeat(code, socket.data.accountId);
  if (!seat) throw actionError('Select a seat first.');
  return seat;
}

export function registerGameHandlers(context: SocketContext, socket: TypedSocket): void {
  socket.on('game:redealResponse', (payload, callback) => runAction(context, socket, callback, () => {
    if (!payload || typeof payload.accept !== 'boolean') throw actionError('Invalid redeal response.');
    const code = requireRoom(socket);
    requireSuccess(gameManager.handleRedealResponse(code, playerSeat(socket, code), payload.accept));
    return { success: true };
  }));

  socket.on('game:bid', (payload, callback) => runAction(context, socket, callback, () => {
    const bid = payload?.bid;
    if (!bid || (bid.type !== 'pass' && (bid.type !== 'bid' || !Number.isInteger(bid.level)
      || bid.level < 1 || bid.level > 7
      || !['clubs', 'diamonds', 'hearts', 'spades', 'nt'].includes(bid.suit)))) {
      throw actionError('Invalid bid.');
    }
    const code = requireRoom(socket);
    requireSuccess(gameManager.handleBid(code, playerSeat(socket, code), bid));
    return { success: true };
  }));

  socket.on('game:playCard', (payload, callback) => runAction(context, socket, callback, () => {
    const card = payload?.card;
    if (!card || !Number.isInteger(card.rank) || card.rank < 2 || card.rank > 14
      || !['clubs', 'diamonds', 'hearts', 'spades'].includes(card.suit)) throw actionError('Invalid card.');
    const code = requireRoom(socket);
    requireSuccess(gameManager.handlePlayCard(code, playerSeat(socket, code), card));
    return { success: true };
  }));

  socket.on('game:continue', (callback) => runAction(context, socket, callback, () => {
    const code = requireRoom(socket);
    if (gameManager.getGameState(code)?.phase !== 'scoring') throw actionError('The game has not ended.');
    gameManager.removeGame(code);
    return { success: true };
  }));
}
// ─── Game Manager：依遊戲類型分派的門面 ───

import type {
  AnyGameState,
  BidAction,
  Card,
  GameType,
  PlayerInfo,
  PlayerVisibleGameState,
  RoomCode,
  Seat,
} from '@shared/types';
import * as bridge from './games/bridge-game';

type Result = { success: true } | { success: false; reason: string };

const NOT_BRIDGE: Result = { success: false, reason: 'This action is not available in this game.' };

/** Missing games fall through to the bridge handlers, which report them. */
function isBridge(roomCode: RoomCode): boolean {
  return (getGameState(roomCode)?.gameType ?? 'bridge') === 'bridge';
}

export function startGame(
  roomCode: RoomCode,
  gameType: GameType,
  players: Record<Seat, PlayerInfo>,
): Result {
  if (gameType !== 'bridge') return { success: false, reason: 'Big Two is not available yet.' };
  bridge.startGame(roomCode, players);
  return { success: true };
}

export function getPlayerVisibleState(roomCode: RoomCode, seat: Seat): PlayerVisibleGameState | null {
  return bridge.getPlayerVisibleState(roomCode, seat);
}

export function getGameState(roomCode: RoomCode): AnyGameState | null {
  return bridge.getGameState(roomCode);
}

/** Ends a game without a match record. */
export function abortGame(roomCode: RoomCode): void {
  bridge.abortGame(roomCode);
}

export function removeGame(roomCode: RoomCode): void {
  bridge.abortGame(roomCode);
}

export function hasActiveGame(roomCode: RoomCode): boolean {
  return getGameState(roomCode) !== null;
}

export function exportGames(): AnyGameState[] {
  return bridge.exportGames();
}

export function restoreGames(records: AnyGameState[]): void {
  bridge.restoreGames(records.filter((game) => game.gameType === 'bridge'));
}

export function handleRedealResponse(roomCode: RoomCode, seat: Seat, accept: boolean): Result {
  return isBridge(roomCode) ? bridge.handleRedealResponse(roomCode, seat, accept) : NOT_BRIDGE;
}

export function handleBid(roomCode: RoomCode, seat: Seat, action: BidAction): Result {
  return isBridge(roomCode) ? bridge.handleBid(roomCode, seat, action) : NOT_BRIDGE;
}

export function handlePlayCard(roomCode: RoomCode, seat: Seat, card: Card): Result {
  return isBridge(roomCode) ? bridge.handlePlayCard(roomCode, seat, card) : NOT_BRIDGE;
}

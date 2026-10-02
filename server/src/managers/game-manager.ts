// ─── Game Manager：依遊戲類型分派的門面 ───

import type {
  AnyGameState,
  BidAction,
  BigTwoGameState,
  BridgeGameState,
  Card,
  GameType,
  PlayerInfo,
  PlayerVisibleGameState,
  RoomCode,
  Seat,
} from '@shared/types';
import * as bridge from './games/bridge-game';
import * as bigtwo from './games/bigtwo-game';

type Result = { success: true } | { success: false; reason: string };

const WRONG_GAME: Result = { success: false, reason: 'This action is not available in this game.' };

/** Missing games fall through to the game handlers, which report them. */
function isGame(roomCode: RoomCode, gameType: GameType): boolean {
  return (getGameState(roomCode)?.gameType ?? gameType) === gameType;
}

export function startGame(
  roomCode: RoomCode,
  gameType: GameType,
  players: Record<Seat, PlayerInfo>,
): Result {
  // A finished board of another game type may still be waiting for game:continue.
  removeGame(roomCode);
  if (gameType === 'bigtwo') bigtwo.startGame(roomCode, players);
  else bridge.startGame(roomCode, players);
  return { success: true };
}

export function getPlayerVisibleState(roomCode: RoomCode, seat: Seat): PlayerVisibleGameState | null {
  return bridge.getPlayerVisibleState(roomCode, seat) ?? bigtwo.getPlayerVisibleState(roomCode, seat);
}

export function getGameState(roomCode: RoomCode): AnyGameState | null {
  return bridge.getGameState(roomCode) ?? bigtwo.getGameState(roomCode);
}

/** Ends a game without a match record. */
export function abortGame(roomCode: RoomCode): void {
  bridge.abortGame(roomCode);
  bigtwo.abortGame(roomCode);
}

export function removeGame(roomCode: RoomCode): void {
  abortGame(roomCode);
}

export function hasActiveGame(roomCode: RoomCode): boolean {
  return getGameState(roomCode) !== null;
}

export function exportGames(): AnyGameState[] {
  return [...bridge.exportGames(), ...bigtwo.exportGames()];
}

export function restoreGames(records: AnyGameState[]): void {
  bridge.restoreGames(records.filter((game): game is BridgeGameState => game.gameType === 'bridge'));
  bigtwo.restoreGames(records.filter((game): game is BigTwoGameState => game.gameType === 'bigtwo'));
}

export function handleRedealResponse(roomCode: RoomCode, seat: Seat, accept: boolean): Result {
  return isGame(roomCode, 'bridge') ? bridge.handleRedealResponse(roomCode, seat, accept) : WRONG_GAME;
}

export function handleBid(roomCode: RoomCode, seat: Seat, action: BidAction): Result {
  return isGame(roomCode, 'bridge') ? bridge.handleBid(roomCode, seat, action) : WRONG_GAME;
}

export function handlePlayCard(roomCode: RoomCode, seat: Seat, card: Card): Result {
  return isGame(roomCode, 'bridge') ? bridge.handlePlayCard(roomCode, seat, card) : WRONG_GAME;
}

export function handleBigTwoPlay(roomCode: RoomCode, seat: Seat, cards: readonly Card[]): Result {
  return isGame(roomCode, 'bigtwo') ? bigtwo.play(roomCode, seat, cards) : WRONG_GAME;
}

export function handleBigTwoPass(roomCode: RoomCode, seat: Seat): Result {
  return isGame(roomCode, 'bigtwo') ? bigtwo.pass(roomCode, seat) : WRONG_GAME;
}

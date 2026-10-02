import { isDeepStrictEqual } from 'node:util';
import type { GameType, PlayerInfo, RoomCode, RoomInfo, RoomStatus, Seat, SeatMap } from '@shared/types';
import type { PersistedRoom } from '../runtime/types';
import { generateRoomCode } from '../utils/id-generator';

const rooms = new Map<RoomCode, PersistedRoom>();
const seats: Seat[] = ['N', 'E', 'S', 'W'];
type Result = { success: true } | { success: false; reason: string };

function emptySeats(): SeatMap {
  return {
    N: { player: null, isReady: false }, E: { player: null, isReady: false },
    S: { player: null, isReady: false }, W: { player: null, isReady: false },
  };
}

export function createRoom(gameType: GameType, creatorId: string): RoomCode {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  rooms.set(code, {
    info: { code, gameType, status: 'waiting', seats: emptySeats(), createdAt: Date.now() },
    memberIds: [creatorId],
  });
  return code;
}

export function getRoomInfo(code: RoomCode): RoomInfo | null {
  return rooms.get(code)?.info ?? null;
}

export function getRoomMemberIds(code: RoomCode): readonly string[] {
  return rooms.get(code)?.memberIds.slice() ?? [];
}

export function joinRoom(code: RoomCode, playerId: string): Result {
  const room = rooms.get(code);
  if (!room) return { success: false, reason: 'Room not found' };
  if (room.memberIds.includes(playerId)) return { success: true };
  if (room.info.status === 'playing') return { success: false, reason: 'Game is in progress' };
  if (room.memberIds.length >= 4) return { success: false, reason: 'Room is full' };
  room.memberIds.push(playerId);
  return { success: true };
}

export function leaveRoom(code: RoomCode, playerId: string): { seat: Seat | null; roomEmpty: boolean } {
  const room = rooms.get(code);
  if (!room) return { seat: null, roomEmpty: true };
  const seat = getPlayerSeat(code, playerId);
  if (seat) room.info = {
    ...room.info, seats: { ...room.info.seats, [seat]: { player: null, isReady: false } },
  };
  room.memberIds = room.memberIds.filter((id) => id !== playerId);
  const roomEmpty = room.memberIds.length === 0;
  if (roomEmpty) rooms.delete(code);
  return { seat, roomEmpty };
}

export function changeSeat(code: RoomCode, player: PlayerInfo, target: Seat): Result {
  const room = rooms.get(code);
  if (!room || !room.memberIds.includes(player.id)) return { success: false, reason: 'Not in room' };
  if (room.info.status === 'playing') return { success: false, reason: 'Cannot change seat during game' };
  const occupant = room.info.seats[target].player;
  if (occupant && occupant.id !== player.id) return { success: false, reason: 'Seat is occupied' };
  const previous = getPlayerSeat(code, player.id);
  if (previous === target) return { success: true };
  const next = { ...room.info.seats };
  if (previous) next[previous] = { player: null, isReady: false };
  next[target] = { player, isReady: false };
  room.info = { ...room.info, seats: next };
  return { success: true };
}

export function setReady(code: RoomCode, playerId: string, ready: boolean): Result {
  const room = rooms.get(code);
  const seat = getPlayerSeat(code, playerId);
  if (!room || !seat) return { success: false, reason: 'Not seated' };
  if (room.info.status === 'playing') return { success: false, reason: 'Game is in progress' };
  room.info = { ...room.info, seats: {
    ...room.info.seats, [seat]: { ...room.info.seats[seat], isReady: ready },
  } };
  return { success: true };
}

export function isAllReady(code: RoomCode): boolean {
  const room = rooms.get(code);
  return Boolean(room && seats.every((seat) => room.info.seats[seat].player && room.info.seats[seat].isReady));
}

export function getPlayerSeat(code: RoomCode, playerId: string): Seat | null {
  const room = rooms.get(code);
  return room ? seats.find((seat) => room.info.seats[seat].player?.id === playerId) ?? null : null;
}

export function getSeatPlayers(code: RoomCode): Record<Seat, PlayerInfo> | null {
  const room = rooms.get(code);
  if (!room || seats.some((seat) => !room.info.seats[seat].player)) return null;
  return {
    N: room.info.seats.N.player!, E: room.info.seats.E.player!,
    S: room.info.seats.S.player!, W: room.info.seats.W.player!,
  };
}

export function setRoomStatus(code: RoomCode, status: RoomStatus): void {
  const room = rooms.get(code);
  if (room) room.info = { ...room.info, status };
}

export function resetAllReady(code: RoomCode): void {
  const room = rooms.get(code);
  if (!room) return;
  const next = { ...room.info.seats };
  for (const seat of seats) next[seat] = { ...next[seat], isReady: false };
  room.info = { ...room.info, seats: next };
}

export function updateRoomPlayer(player: PlayerInfo, roomCode: RoomCode | null): void {
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  const seat = getPlayerSeat(roomCode, player.id);
  if (!room || !seat || isDeepStrictEqual(room.info.seats[seat].player, player)) return;
  room.info = { ...room.info, seats: {
    ...room.info.seats, [seat]: { ...room.info.seats[seat], player },
  } };
}

export function exportRooms(): PersistedRoom[] {
  return [...rooms.values()];
}

export function restoreRooms(records: PersistedRoom[]): void {
  rooms.clear();
  for (const room of records) rooms.set(room.info.code, room);
}

import type { ChatMessage, GameState, PlayerInfo, RoomInfo } from '@shared/types';

export interface PersistedPlayer {
  info: PlayerInfo;
  currentRoomCode: string | null;
  disconnectedAt: number | null;
}

export interface PersistedRoom {
  info: RoomInfo;
  memberIds: string[];
}

export interface RuntimeSnapshot {
  players: PersistedPlayer[];
  rooms: PersistedRoom[];
  games: GameState[];
  chat: { roomCode: string; messages: ChatMessage[] }[];
}

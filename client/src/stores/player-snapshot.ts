import type { PlayerSnapshot } from '@shared/types';
import { useAccountStore } from './account-store';
import { usePlayerStore } from './player-store';
import { useRoomStore } from './room-store';
import { useGameStore } from './game-store';
import { useChatStore } from './chat-store';

export function applyPlayerSnapshot(snapshot: PlayerSnapshot): void {
  if (!snapshot.success || !snapshot.player) return;
  const account = useAccountStore.getState().account;
  if (!account || snapshot.player.id !== account.id) return;
  usePlayerStore.getState().setPlayer(snapshot.player);
  useAccountStore.getState().setAccount({ ...account, ...snapshot.player });
  if (snapshot.room) {
    useRoomStore.getState().setRoom(snapshot.room.code, snapshot.room);
    const seat = (['N', 'E', 'S', 'W'] as const).find(
      (value) => snapshot.room?.seats[value].player?.id === snapshot.player?.id,
    );
    useRoomStore.getState().setMySeat(seat ?? null);
  } else {
    useRoomStore.getState().leaveRoom();
  }
  if (snapshot.gameState) {
    useGameStore.getState().restore(snapshot.gameState);
  } else {
    useGameStore.getState().reset();
  }
  useChatStore.getState().setMessages(snapshot.chatHistory ?? []);
  useAccountStore.getState().setConnection('ready');
}

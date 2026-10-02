import { create } from 'zustand';
import type { PlayerInfo } from '@shared/types';
import { retainSnapshotValue } from './snapshot-equality';

interface PlayerStore {
  playerId: string | null;
  player: PlayerInfo | null;
  setPlayer: (player: PlayerInfo) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  playerId: null,
  player: null,
  setPlayer: (player) => set((state) => {
    const nextPlayer = retainSnapshotValue(state.player, player);
    return nextPlayer === state.player && state.playerId === player.id
      ? state : { playerId: player.id, player: nextPlayer };
  }),
  reset: () => set((state) => state.playerId === null && state.player === null
    ? state : { playerId: null, player: null }),
}));

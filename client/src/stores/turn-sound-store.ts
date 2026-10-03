import { create } from 'zustand';

const STORAGE_KEY = 'bridge.sound.turn';
interface TurnSoundState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

function savedEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; } catch { return true; }
}

export const useTurnSoundStore = create<TurnSoundState>((set) => ({
  enabled: savedEnabled(),
  setEnabled: (enabled) => {
    set({ enabled });
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* Storage is optional. */ }
  },
}));

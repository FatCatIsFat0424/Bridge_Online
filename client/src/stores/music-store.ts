// ─── Music Store：背景音樂（跨路由存活的單例播放器） ───

import { create } from 'zustand';
import { createBackgroundMusic } from '../audio/background-music';
import type { BackgroundMusic } from '../audio/background-music';

const VOLUME_KEY = 'bridge.music.volume';
const DEFAULT_VOLUME = 0.25;

interface MusicState {
  playing: boolean;
  busy: boolean;
  error: boolean;
  volume: number;
  toggle: () => Promise<void>;
  setVolume: (volume: number) => void;
}

let player: BackgroundMusic | null = null;

function savedVolume(): number {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_VOLUME;
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null ? DEFAULT_VOLUME : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export const useMusicStore = create<MusicState>((set, get) => ({
  playing: false,
  busy: false,
  error: false,
  volume: savedVolume(),
  toggle: async () => {
    set({ busy: true, error: false });
    if (!player) {
      player = createBackgroundMusic((playing) => set({ playing }));
      player.setVolume(get().volume);
    }
    try {
      if (get().playing) await player.pause();
      else await player.play();
    } catch {
      player?.dispose();
      player = null;
      set({ playing: false, error: true });
    } finally {
      set({ busy: false });
    }
  },
  setVolume: (volume) => {
    set({ volume });
    player?.setVolume(volume);
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* Storage is optional. */ }
  },
}));

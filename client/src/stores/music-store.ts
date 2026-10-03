// ─── Music Store：背景音樂（跨路由存活的單例播放器與播放清單） ───

import { create } from 'zustand';
import { createBackgroundMusic } from '../audio/background-music';
import type { BackgroundMusic } from '../audio/background-music';
import { MUSIC_TRACKS, nextTrackIndex } from '../audio/music-tracks';
import type { MusicMode } from '../audio/music-tracks';

const VOLUME_KEY = 'bridge.music.volume';
const TRACK_KEY = 'bridge.music.track';
const MODE_KEY = 'bridge.music.mode';
const DEFAULT_VOLUME = 0.25;
const LOOPS_PER_TRACK = 2;
const MODES: readonly MusicMode[] = ['loop-one', 'sequential', 'shuffle'];

interface MusicState {
  playing: boolean;
  busy: boolean;
  error: boolean;
  volume: number;
  trackId: string;
  mode: MusicMode;
  toggle: () => Promise<void>;
  play: (trackId?: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  setMode: (mode: MusicMode) => void;
  setVolume: (volume: number) => void;
}

let player: BackgroundMusic | null = null;

function stored(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}

function savedVolume(): number {
  const value = Number(stored(VOLUME_KEY) ?? DEFAULT_VOLUME);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;
}

function trackIndex(trackId: string): number {
  return Math.max(0, MUSIC_TRACKS.findIndex((track) => track.id === trackId));
}

export const useMusicStore = create<MusicState>((set, get) => {
  const step = (direction: 1 | -1): Promise<void> => {
    const { trackId, mode } = get();
    const index = nextTrackIndex(trackIndex(trackId), MUSIC_TRACKS.length,
      mode === 'loop-one' ? 'sequential' : mode, Math.random, direction);
    return get().play(MUSIC_TRACKS[index].id);
  };
  const fail = (): void => {
    player?.dispose();
    player = null;
    set({ playing: false, error: true });
  };

  return {
    playing: false,
    busy: false,
    error: false,
    volume: savedVolume(),
    trackId: MUSIC_TRACKS[trackIndex(stored(TRACK_KEY) ?? '')].id,
    mode: MODES.find((mode) => mode === stored(MODE_KEY)) ?? 'loop-one',
    toggle: async () => {
      if (!get().playing) return get().play();
      set({ busy: true, error: false });
      try {
        await player?.pause();
      } catch {
        fail();
      } finally {
        set({ busy: false });
      }
    },
    play: async (trackId) => {
      const track = MUSIC_TRACKS[trackIndex(trackId ?? get().trackId)];
      set({ trackId: track.id, busy: true, error: false });
      store(TRACK_KEY, track.id);
      if (!player) {
        player = createBackgroundMusic((playing) => set({ playing }), () => {
          const { trackId: ended, mode } = get();
          const index = nextTrackIndex(trackIndex(ended), MUSIC_TRACKS.length, mode, Math.random);
          void get().play(MUSIC_TRACKS[index].id);
        });
        player.setVolume(get().volume);
      }
      try {
        await player.play(track, get().mode === 'loop-one' ? null : LOOPS_PER_TRACK);
      } catch {
        fail();
      } finally {
        set({ busy: false });
      }
    },
    next: () => step(1),
    prev: () => step(-1),
    setMode: (mode) => {
      set({ mode });
      store(MODE_KEY, mode);
      if (get().playing) void get().play();
    },
    setVolume: (volume) => {
      set({ volume });
      player?.setVolume(volume);
      store(VOLUME_KEY, String(volume));
    },
  };
});

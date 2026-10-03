import { create } from 'zustand';

interface MotionStore {
  reducedMotion: boolean;
  setReducedMotion: (reducedMotion: boolean) => void;
}

const STORAGE_KEY = 'bridge.ui.reducedMotion';

function initialReducedMotion(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true' || saved === 'false') return saved === 'true';
  } catch {
    // Storage may be unavailable in private browsing.
  }
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const useMotionStore = create<MotionStore>((set) => ({
  reducedMotion: initialReducedMotion(),
  setReducedMotion: (reducedMotion: boolean): void => {
    try {
      localStorage.setItem(STORAGE_KEY, String(reducedMotion));
    } catch {
      // Keep the preference available for this session when storage is blocked.
    }
    set({ reducedMotion });
  },
}));

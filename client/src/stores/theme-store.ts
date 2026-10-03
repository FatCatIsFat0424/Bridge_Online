// ─── Theme Store：介面主題 ───

import { create } from 'zustand';

export type Theme = 'dashboard' | 'felt' | 'paper';
export const THEMES: readonly Theme[] = ['dashboard', 'felt', 'paper'];

const STORAGE_KEY = 'bridge.theme';

export function parseTheme(value: string | null | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? 'dashboard';
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
}

function readStoredTheme(): Theme {
  try {
    return parseTheme(typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'dashboard';
  }
}

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage is optional.
    }
  },
}));

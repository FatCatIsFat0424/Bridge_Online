import { create } from 'zustand';
import type { EmojiRecord } from '@shared/types';
import { apiRequest } from '../api';

interface EmojiStore {
  emojis: EmojiRecord[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Fetches the signed-in account's library once; later calls are no-ops until reset. */
  load: () => Promise<void>;
  setEmojis: (emojis: EmojiRecord[]) => void;
  reset: () => void;
}

export const useEmojiStore = create<EmojiStore>((set, get) => ({
  emojis: [],
  status: 'idle',
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading' });
    const result = await apiRequest<{ emojis: EmojiRecord[] }>('/api/emojis');
    if (get().status !== 'loading') return;
    set(result.success ? { emojis: result.emojis, status: 'ready' } : { status: 'error' });
  },
  setEmojis: (emojis) => set({ emojis, status: 'ready' }),
  reset: () => set({ emojis: [], status: 'idle' }),
}));

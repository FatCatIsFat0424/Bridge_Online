// ─── Invite Store：收到的房間邀請（最多 3 則，30 秒自動消失） ───

import { create } from 'zustand';
import type { RoomInvite } from '@shared/types';

const MAX_INVITES = 3;
const INVITE_TTL_MS = 30_000;

export interface ReceivedInvite extends RoomInvite {
  id: number;
}

interface InviteStoreState {
  invites: ReceivedInvite[];
  receive: (invite: RoomInvite) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

export const useInviteStore = create<InviteStoreState>((set, get) => ({
  invites: [],
  receive: (invite) => {
    nextId += 1;
    const id = nextId;
    set((state) => ({ invites: [...state.invites.filter((entry) =>
      entry.roomCode !== invite.roomCode || entry.from.id !== invite.from.id), { ...invite, id }]
      .slice(-MAX_INVITES) }));
    setTimeout(() => get().dismiss(id), INVITE_TTL_MS);
  },
  dismiss: (id) => set((state) => ({ invites: state.invites.filter((entry) => entry.id !== id) })),
}));

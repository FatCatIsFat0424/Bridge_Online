import type { PlayerId } from '@shared/types';

export const INVITE_COOLDOWN_MS = 15_000;

/** Last invite time per inviter→target pair; ephemeral, lost on restart by design. */
const lastInvites = new Map<string, number>();

/** Records an invite unless the same pair was invited within the cooldown. */
export function tryReserveInvite(fromId: PlayerId, toId: PlayerId, now: number = Date.now()): boolean {
  for (const [key, at] of lastInvites) {
    if (now - at >= INVITE_COOLDOWN_MS) lastInvites.delete(key);
  }
  const key = `${fromId}\n${toId}`;
  if (lastInvites.has(key)) return false;
  lastInvites.set(key, now);
  return true;
}

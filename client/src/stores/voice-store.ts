import { create } from 'zustand';
import { socket } from '../socket';
import { parseIceServers } from '../voice/ice-servers';
import { createVoiceSession, initialVoiceState } from '../voice/voice-session';
import type { VoiceClientState, VoiceSession } from '../voice/voice-session';

export type { VoiceErrorCode } from '../voice/voice-session';

export const useVoiceStore = create<VoiceClientState>(() => initialVoiceState());
let session: VoiceSession | null = null;

function currentSession(): VoiceSession {
  if (!session) {
    const { muted, deafened } = useVoiceStore.getState();
    session = createVoiceSession(socket, (state) => useVoiceStore.setState(state), {
      muted,
      deafened,
      iceServers: () => parseIceServers(import.meta.env.VITE_WEBRTC_ICE_SERVERS),
    });
  }
  return session;
}

export async function joinVoice(roomCode: string, accountId: string): Promise<void> {
  await currentSession().join(roomCode, accountId);
}

export function leaveVoice(): void {
  session?.leave();
}

export function setVoiceMuted(muted: boolean): void {
  if (session) session.setMuted(muted);
  else useVoiceStore.setState({ muted });
}

export function setVoiceDeafened(deafened: boolean): void {
  if (session) session.setDeafened(deafened);
  else useVoiceStore.setState({ deafened });
}

export async function resumeVoiceAudio(): Promise<void> {
  await session?.resumeAudio();
}

export function disposeVoice(): void {
  session?.dispose();
  session = null;
}

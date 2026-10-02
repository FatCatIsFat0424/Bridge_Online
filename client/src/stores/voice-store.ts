import { create } from 'zustand';
import { socket } from '../socket';
import { parseIceServers } from '../voice/ice-servers';
import {
  createVoiceSession,
  initialVoiceState,
  listAudioDevices,
  parsePeerPrefs,
} from '../voice/voice-session';
import type { VoiceClientState, VoiceSession } from '../voice/voice-session';

export type { VoiceErrorCode } from '../voice/voice-session';

const PEERS_KEY = 'bridge.voice.peers';
const INPUT_KEY = 'bridge.voice.input';
const OUTPUT_KEY = 'bridge.voice.output';

interface VoiceStoreState extends VoiceClientState {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
}

function stored(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persist(state: VoiceClientState): void {
  try {
    localStorage.setItem(PEERS_KEY, JSON.stringify(state.peerPrefs));
    for (const [key, value] of [[INPUT_KEY, state.inputDeviceId], [OUTPUT_KEY, state.outputDeviceId]] as const) {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }
  } catch { /* Storage is optional. */ }
}

export const useVoiceStore = create<VoiceStoreState>(() => ({
  ...initialVoiceState(),
  inputDeviceId: stored(INPUT_KEY),
  outputDeviceId: stored(OUTPUT_KEY),
  peerPrefs: parsePeerPrefs(stored(PEERS_KEY)),
  inputs: [],
  outputs: [],
}));
let session: VoiceSession | null = null;

function update(state: Partial<VoiceClientState>): void {
  useVoiceStore.setState(state);
  persist(useVoiceStore.getState());
}

function currentSession(): VoiceSession {
  if (!session) {
    const { muted, deafened, inputDeviceId, outputDeviceId, peerPrefs } = useVoiceStore.getState();
    session = createVoiceSession(socket, update, {
      muted,
      deafened,
      inputDeviceId,
      outputDeviceId,
      peerPrefs,
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

export async function setVoiceInputDevice(deviceId: string | null): Promise<void> {
  if (session) await session.setInputDevice(deviceId);
  else update({ inputDeviceId: deviceId });
}

export function setVoiceOutputDevice(deviceId: string | null): void {
  if (session) session.setOutputDevice(deviceId);
  else update({ outputDeviceId: deviceId });
}

// Per-player controls only render while joined, so a session always exists here.
export function setVoicePeerMuted(accountId: string, muted: boolean): void {
  session?.setPeerMuted(accountId, muted);
}

export function setVoicePeerVolume(accountId: string, volume: number): void {
  session?.setPeerVolume(accountId, volume);
}

/** Loads the device lists now and whenever devices change; returns the unsubscribe. */
export function watchAudioDevices(): () => void {
  const refresh = (): void => {
    void listAudioDevices().then(({ inputs, outputs }) => useVoiceStore.setState({ inputs, outputs }))
      .catch(() => undefined);
  };
  refresh();
  navigator.mediaDevices?.addEventListener('devicechange', refresh);
  return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh);
}

export async function resumeVoiceAudio(): Promise<void> {
  await session?.resumeAudio();
}

export function disposeVoice(): void {
  session?.dispose();
  session = null;
}

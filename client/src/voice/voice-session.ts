import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';
import type {
  VoiceIncomingSignal,
  VoiceParticipant,
  VoiceRoomState,
  VoiceSignal,
} from '@shared/types/voice';
import { parseIceServers } from './ice-servers';

export type VoiceErrorCode =
  | 'unsupported'
  | 'insecure'
  | 'permission'
  | 'no-microphone'
  | 'microphone-busy'
  | 'microphone-ended'
  | 'configuration'
  | 'join-failed'
  | 'connection-failed'
  | 'signal-failed'
  | 'disconnected';

export interface VoiceClientState {
  status: 'idle' | 'joining' | 'joined' | 'error';
  roomCode: string | null;
  peerId: string | null;
  participants: VoiceParticipant[];
  muted: boolean;
  deafened: boolean;
  error: VoiceErrorCode | null;
  autoplayBlocked: boolean;
}

export interface VoiceSession {
  join(roomCode: string, accountId: string): Promise<void>;
  leave(): void;
  setMuted(muted: boolean): void;
  setDeafened(deafened: boolean): void;
  resumeAudio(): Promise<void>;
  dispose(): void;
}

export type VoiceSocket = Pick<
  Socket<ServerToClientEvents, ClientToServerEvents>,
  'id' | 'connected' | 'on' | 'off' | 'timeout'
>;

// Disposed controllers may still await an acknowledgment. Keep membership operations
// ordered across replacement controllers sharing the same connected socket.
const socketControls = new WeakMap<VoiceSocket, Promise<void>>();

interface Peer {
  id: string;
  connection: RTCPeerConnection;
  audio: HTMLAudioElement;
  queue: Promise<void>;
  queued: number;
  candidates: RTCIceCandidateInit[];
  closed: boolean;
  blocked: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function initialVoiceState(): VoiceClientState {
  return {
    status: 'idle',
    roomCode: null,
    peerId: null,
    participants: [],
    muted: false,
    deafened: false,
    error: null,
    autoplayBlocked: false,
  };
}

function mediaError(error: unknown): VoiceErrorCode {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-microphone';
  return 'microphone-busy';
}

/** One explicit microphone session, at most three remote audio peers, and no automatic rejoin. */
export function createVoiceSession(
  socket: VoiceSocket,
  onChange: (state: VoiceClientState) => void,
  options: { iceServers?: () => RTCIceServer[]; muted?: boolean; deafened?: boolean } = {},
): VoiceSession {
  let state = {
    ...initialVoiceState(),
    muted: options.muted ?? false,
    deafened: options.deafened ?? false,
  };
  let generation = 0;
  let disposed = false;
  let localStream: MediaStream | null = null;
  let currentAccount: string | null = null;
  let configuration: RTCConfiguration = {};
  let latestState: VoiceRoomState | null = null;
  let pendingSignals: VoiceIncomingSignal[] = [];
  let membershipPossible = false;
  let membershipGeneration = -1;
  let membershipSocketId: string | undefined;
  const peers = new Map<string, Peer>();
  const trackListeners = new Map<MediaStreamTrack, () => void>();

  function publish(update: Partial<VoiceClientState>): void {
    state = { ...state, ...update };
    if (!disposed)
      onChange({
        ...state,
        participants: state.participants.map((participant) => ({ ...participant })),
      });
  }

  function control<T>(operation: () => Promise<T>): Promise<T> {
    const result = (socketControls.get(socket) ?? Promise.resolve()).then(operation);
    socketControls.set(
      socket,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }

  function active(peer: Peer): boolean {
    return !disposed && state.status === 'joined' && !peer.closed && peers.get(peer.id) === peer;
  }

  function playbackState(): void {
    publish({ autoplayBlocked: [...peers.values()].some((peer) => !peer.closed && peer.blocked) });
  }

  async function playAudio(peer: Peer): Promise<void> {
    if (!active(peer) || !peer.audio.srcObject) return;
    try {
      await peer.audio.play();
      if (active(peer)) peer.blocked = false;
    } catch {
      if (active(peer)) peer.blocked = true;
    }
    if (active(peer)) playbackState();
  }

  function closePeer(peer: Peer): void {
    if (peer.closed) return;
    peer.closed = true;
    if (peer.timer) clearTimeout(peer.timer);
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.onconnectionstatechange = null;
    peer.connection.close();
    peer.audio.pause();
    peer.audio.srcObject = null;
    peer.audio.remove();
    peer.candidates = [];
  }

  function release(error: VoiceErrorCode | null = null, notify = true): void {
    generation += 1;
    for (const [track, listener] of trackListeners) track.removeEventListener('ended', listener);
    trackListeners.clear();
    localStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
    for (const peer of peers.values()) closePeer(peer);
    peers.clear();
    currentAccount = null;
    latestState = null;
    pendingSignals = [];
    if (notify && membershipPossible && socket.connected) {
      const previousSocketId = membershipSocketId;
      void control(async () => {
        if (socket.connected && socket.id === previousSocketId)
          await socket.timeout(10_000).emitWithAck('voice:leave');
        membershipPossible = false;
      }).catch(() => undefined);
    } else if (!notify || !socket.connected) membershipPossible = false;
    publish({
      status: error ? 'error' : 'idle',
      roomCode: null,
      peerId: null,
      participants: [],
      error,
      autoplayBlocked: false,
    });
  }

  function failPeer(peer: Peer, error: VoiceErrorCode): void {
    if (!active(peer)) return;
    closePeer(peer);
    publish({ error });
    playbackState();
  }

  function enqueue(peer: Peer, operation: () => Promise<void>): void {
    if (!active(peer)) return;
    if (peer.queued >= 128) {
      failPeer(peer, 'signal-failed');
      return;
    }
    peer.queued += 1;
    peer.queue = peer.queue
      .then(async () => {
        if (active(peer)) await operation();
      })
      .catch(() => {
        failPeer(peer, 'connection-failed');
      })
      .finally(() => {
        peer.queued -= 1;
      });
  }

  async function sendSignal(peer: Peer, signal: Omit<VoiceSignal, 'targetPeerId'>): Promise<void> {
    if (!active(peer) || !socket.connected) return;
    try {
      const response = await socket
        .timeout(10_000)
        .emitWithAck('voice:signal', { targetPeerId: peer.id, ...signal });
      if (!response.success) failPeer(peer, 'signal-failed');
    } catch {
      failPeer(peer, 'signal-failed');
    }
  }

  async function sendDescription(peer: Peer): Promise<void> {
    const description = peer.connection.localDescription;
    if (
      active(peer) &&
      description &&
      (description.type === 'offer' || description.type === 'answer')
    ) {
      await sendSignal(peer, { description: { type: description.type, sdp: description.sdp } });
    }
  }

  function createPeer(id: string): Peer {
    const connection = new RTCPeerConnection(configuration);
    let audio: HTMLAudioElement;
    try {
      audio = new Audio();
    } catch (error) {
      connection.close();
      throw error;
    }
    const peer: Peer = {
      id,
      connection,
      audio,
      queue: Promise.resolve(),
      queued: 0,
      candidates: [],
      closed: false,
      blocked: false,
      timer: null,
    };
    peers.set(id, peer);
    audio.hidden = true;
    audio.muted = state.deafened;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('data-voice-peer', id);
    document.body.appendChild(audio);
    connection.onicecandidate = (event): void => {
      if (event.candidate && active(peer)) {
        const candidate = event.candidate.toJSON();
        void sendSignal(peer, {
          candidate: {
            candidate: candidate.candidate ?? '',
            sdpMid: candidate.sdpMid ?? null,
            sdpMLineIndex: candidate.sdpMLineIndex ?? null,
            usernameFragment: candidate.usernameFragment,
          },
        });
      }
    };
    connection.ontrack = (event): void => {
      if (!active(peer) || event.track.kind !== 'audio') return;
      audio.muted = state.deafened;
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void playAudio(peer);
    };
    connection.onconnectionstatechange = (): void => {
      if (!active(peer)) return;
      if (connection.connectionState === 'failed') failPeer(peer, 'connection-failed');
      if (connection.connectionState === 'connected' && peer.timer) {
        clearTimeout(peer.timer);
        peer.timer = null;
      }
      if (connection.connectionState === 'disconnected' && !peer.timer) {
        peer.timer = setTimeout(() => {
          if (connection.connectionState !== 'connected') failPeer(peer, 'connection-failed');
        }, 30_000);
      }
    };
    peer.timer = setTimeout(() => {
      if (connection.connectionState !== 'connected') failPeer(peer, 'connection-failed');
    }, 30_000);
    for (const track of localStream!.getAudioTracks()) connection.addTrack(track, localStream!);
    // The smaller fresh peer ID is the only offerer; mute/deafen never renegotiate tracks.
    if (state.peerId! < id)
      enqueue(peer, async () => {
        const offer = await connection.createOffer();
        if (!active(peer)) return;
        await connection.setLocalDescription(offer);
        if (active(peer)) await sendDescription(peer);
      });
    return peer;
  }

  function applyState(room: VoiceRoomState): void {
    if (state.status !== 'joined' || room.roomCode !== state.roomCode) return;
    if (
      !room.participants.some(
        (participant) =>
          participant.peerId === state.peerId && participant.accountId === currentAccount,
      )
    ) {
      release('join-failed');
      return;
    }
    const participants = room.participants
      .slice(0, 4)
      .map((participant) =>
        participant.peerId === state.peerId
          ? { ...participant, muted: state.muted, deafened: state.deafened }
          : { ...participant },
      );
    const remoteIds = new Set(
      participants
        .filter((participant) => participant.peerId !== state.peerId)
        .map((participant) => participant.peerId),
    );
    for (const [id, peer] of peers)
      if (!remoteIds.has(id)) {
        closePeer(peer);
        peers.delete(id);
      }
    publish({ participants });
    try {
      for (const id of remoteIds) if (!peers.has(id)) createPeer(id);
    } catch {
      release('connection-failed');
    }
    playbackState();
  }

  function receiveSignal(signal: VoiceIncomingSignal): void {
    if (state.status === 'joining') {
      if (membershipGeneration === generation && pendingSignals.length < 128)
        pendingSignals.push(signal);
      return;
    }
    const peer = peers.get(signal.fromPeerId);
    if (!peer || !active(peer)) return;
    enqueue(peer, async () => {
      const connection = peer.connection;
      if (signal.description) {
        const description = signal.description;
        if (description.type === 'offer' && signal.fromPeerId > state.peerId!) return;
        if (description.type === 'answer' && connection.signalingState !== 'have-local-offer')
          return;
        await connection.setRemoteDescription(description);
        if (!active(peer)) return;
        while (peer.candidates.length > 0 && active(peer))
          await connection.addIceCandidate(peer.candidates.shift()!);
        if (description.type === 'offer' && active(peer)) {
          const answer = await connection.createAnswer();
          if (!active(peer)) return;
          await connection.setLocalDescription(answer);
          if (active(peer)) await sendDescription(peer);
        }
      } else if (signal.candidate) {
        if (connection.remoteDescription) await connection.addIceCandidate(signal.candidate);
        else if (peer.candidates.length < 128) peer.candidates.push(signal.candidate);
        else failPeer(peer, 'signal-failed');
      }
    });
  }

  function receiveState(room: VoiceRoomState): void {
    if (room.roomCode !== state.roomCode) return;
    if (state.status === 'joining' && membershipGeneration === generation) latestState = room;
    else applyState(room);
  }

  function handleDisconnect(): void {
    if (state.status === 'joined' || state.status === 'joining') release('disconnected', false);
  }

  function handleLeft(): void {
    if (state.status === 'joining' && membershipGeneration !== generation) return;
    if (state.status === 'joined' || state.status === 'joining') release('join-failed', false);
  }

  function sendSettings(): void {
    if (state.status !== 'joined') return;
    const currentGeneration = generation;
    void control(async () => {
      if (currentGeneration !== generation || state.status !== 'joined') return;
      const response = await socket
        .timeout(10_000)
        .emitWithAck('voice:settings', { muted: state.muted, deafened: state.deafened });
      if (currentGeneration === generation && !response.success) release('signal-failed');
    }).catch(() => {
      if (currentGeneration === generation) release('signal-failed');
    });
  }

  socket.on('voice:state', receiveState);
  socket.on('voice:signal', receiveSignal);
  socket.on('voice:left', handleLeft);
  socket.on('disconnect', handleDisconnect);

  return {
    async join(roomCode, accountId): Promise<void> {
      if (disposed || state.status === 'joining' || state.status === 'joined') return;
      if (!globalThis.isSecureContext) {
        publish({ status: 'error', error: 'insecure' });
        return;
      }
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof RTCPeerConnection === 'undefined' ||
        typeof Audio === 'undefined'
      ) {
        publish({ status: 'error', error: 'unsupported' });
        return;
      }
      if (!socket.connected) {
        publish({ status: 'error', error: 'disconnected' });
        return;
      }
      try {
        configuration = { iceServers: options.iceServers?.() ?? parseIceServers() };
      } catch {
        publish({ status: 'error', error: 'configuration' });
        return;
      }
      const currentGeneration = ++generation;
      currentAccount = accountId;
      publish({ status: 'joining', roomCode, peerId: null, error: null, autoplayBlocked: false });
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch (error) {
        if (currentGeneration === generation && !disposed) release(mediaError(error));
        return;
      }
      if (currentGeneration !== generation || disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStream = stream;
      if (
        stream.getAudioTracks().length === 0 ||
        stream.getAudioTracks().some((track) => track.readyState === 'ended')
      ) {
        release('no-microphone');
        return;
      }
      for (const track of stream.getAudioTracks()) {
        track.enabled = !state.muted;
        const ended = (): void => {
          if (currentGeneration === generation) release('microphone-ended');
        };
        track.addEventListener('ended', ended);
        trackListeners.set(track, ended);
      }
      try {
        await control(async () => {
          if (currentGeneration !== generation || disposed) return;
          membershipPossible = true;
          membershipGeneration = currentGeneration;
          membershipSocketId = socket.id;
          const settings = { muted: state.muted, deafened: state.deafened };
          const result = await socket.timeout(10_000).emitWithAck('voice:join', settings);
          if (currentGeneration !== generation || disposed) return;
          if (
            !result.success ||
            !result.peerId ||
            !result.state ||
            result.state.roomCode !== roomCode
          ) {
            release('join-failed');
            return;
          }
          publish({ status: 'joined', peerId: result.peerId });
          const room = latestState?.participants.some(
            (participant) => participant.peerId === result.peerId,
          )
            ? latestState
            : result.state;
          latestState = null;
          applyState(room);
          const signals = pendingSignals;
          pendingSignals = [];
          for (const signal of signals) receiveSignal(signal);
          if (state.muted !== settings.muted || state.deafened !== settings.deafened)
            sendSettings();
        });
      } catch {
        if (currentGeneration === generation && !disposed) release('join-failed');
      }
    },
    leave: () => release(),
    setMuted(muted): void {
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      publish({ muted });
      sendSettings();
    },
    setDeafened(deafened): void {
      publish({ deafened });
      for (const peer of peers.values()) {
        peer.audio.muted = deafened;
        if (!deafened) void playAudio(peer);
      }
      sendSettings();
    },
    async resumeAudio(): Promise<void> {
      await Promise.all([...peers.values()].map(playAudio));
    },
    dispose(): void {
      if (disposed) return;
      release();
      disposed = true;
      socket.off('voice:state', receiveState);
      socket.off('voice:signal', receiveSignal);
      socket.off('voice:left', handleLeft);
      socket.off('disconnect', handleDisconnect);
    },
  };
}

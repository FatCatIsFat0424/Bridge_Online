import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceIncomingSignal, VoiceJoinResult, VoiceRoomState } from '@shared/types/voice';
import { createVoiceSession, initialVoiceState } from '../../../client/src/voice/voice-session';
import type {
  VoiceClientState,
  VoiceSession,
  VoiceSocket,
} from '../../../client/src/voice/voice-session';
import { parseIceServers } from '../../../client/src/voice/ice-servers';

interface MockPeer {
  signalingState: string;
  connectionState: string;
  localDescription: RTCSessionDescriptionInit | null;
  remoteDescription: RTCSessionDescriptionInit | null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;
  addTrack: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  createAnswer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  addIceCandidate: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function makePeer(): MockPeer {
  const peer: MockPeer = {
    signalingState: 'stable',
    connectionState: 'new',
    localDescription: null,
    remoteDescription: null,
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    addTrack: vi.fn(),
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'local-offer' })),
    createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'local-answer' })),
    setLocalDescription: vi.fn(async (description: RTCSessionDescriptionInit) => {
      peer.localDescription = description;
      peer.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
    }),
    setRemoteDescription: vi.fn(async (description: RTCSessionDescriptionInit) => {
      peer.remoteDescription = description;
      peer.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
    }),
    addIceCandidate: vi.fn(async () => undefined),
    close: vi.fn(() => {
      peer.connectionState = 'closed';
    }),
  };
  return peer;
}

function makeTrack(): EventTarget & {
  kind: string;
  enabled: boolean;
  readyState: string;
  stop: ReturnType<typeof vi.fn>;
} {
  const track = Object.assign(new EventTarget(), {
    kind: 'audio',
    enabled: true,
    readyState: 'live',
    stop: vi.fn(),
  });
  track.stop.mockImplementation(() => {
    track.readyState = 'ended';
  });
  return track;
}

function makeStream(tracks: ReturnType<typeof makeTrack>[]): MediaStream {
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
  } as unknown as MediaStream;
}

function makeAudio(): {
  hidden: boolean;
  muted: boolean;
  srcObject: MediaProvider | null;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  setAttribute: ReturnType<typeof vi.fn>;
} {
  return {
    hidden: false,
    muted: false,
    srcObject: null,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function room(selfId = 'self', remoteIds: string[] = []): VoiceRoomState {
  return {
    roomCode: 'ABC123',
    participants: [
      { peerId: selfId, accountId: 'alice', muted: false, deafened: false },
      ...remoteIds.map((peerId) => ({
        peerId,
        accountId: `account-${peerId}`,
        muted: false,
        deafened: false,
      })),
    ],
  };
}

describe('voice session lifecycle', () => {
  let session: VoiceSession;
  let state: VoiceClientState;
  let microphone: ReturnType<typeof makeTrack>;
  let stream: MediaStream;
  let media: ReturnType<typeof vi.fn>;
  let peerConnections: MockPeer[];
  let audios: ReturnType<typeof makeAudio>[];
  let joinResult: VoiceJoinResult;
  let listeners: Map<string, Set<(payload?: unknown) => void>>;
  let transport: {
    connected: boolean;
    id: string;
    timeout: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  let emit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    microphone = makeTrack();
    stream = makeStream([microphone]);
    media = vi.fn(async () => stream);
    peerConnections = [];
    audios = [];
    state = initialVoiceState();
    listeners = new Map();
    joinResult = { success: true, peerId: 'self', state: room() };
    emit = vi.fn(async (event: string): Promise<unknown> =>
      event === 'voice:join' ? joinResult : { success: true },
    );
    transport = {
      connected: true,
      id: 'socket-1',
      timeout: vi.fn(() => ({ emitWithAck: emit })),
      on: vi.fn((event: string, listener: (payload?: unknown) => void) => {
        const handlers = listeners.get(event) ?? new Set();
        handlers.add(listener);
        listeners.set(event, handlers);
      }),
      off: vi.fn((event: string, listener: (payload?: unknown) => void) => {
        listeners.get(event)?.delete(listener);
      }),
    };
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: media } });
    vi.stubGlobal('document', { body: { appendChild: vi.fn() } });
    vi.stubGlobal(
      'RTCPeerConnection',
      vi.fn(function () {
        const peer = makePeer();
        peerConnections.push(peer);
        return peer;
      }),
    );
    vi.stubGlobal(
      'Audio',
      vi.fn(function () {
        const audio = makeAudio();
        audios.push(audio);
        return audio;
      }),
    );
    vi.stubGlobal(
      'MediaStream',
      vi.fn(function (tracks: ReturnType<typeof makeTrack>[]) {
        return makeStream(tracks);
      }),
    );
    session = createVoiceSession(transport as unknown as VoiceSocket, (next) => {
      state = next;
    });
  });

  afterEach(async () => {
    session.dispose();
    await flush();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function receive(event: string, payload?: unknown): void {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  }

  function incomingTrack(index = 0): void {
    peerConnections[index].ontrack?.({
      track: { kind: 'audio' },
      streams: [makeStream([makeTrack()])],
    } as unknown as RTCTrackEvent);
  }

  it('should allocate no microphone or peers before an explicit join and release all resources on leave', async () => {
    expect(media).not.toHaveBeenCalled();
    expect(peerConnections).toHaveLength(0);
    joinResult = { success: true, peerId: 'self', state: room('self', ['remote']) };
    await session.join('ABC123', 'alice');
    expect(media).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    expect(state.status).toBe('joined');
    expect(peerConnections).toHaveLength(1);
    expect(peerConnections[0].addTrack).toHaveBeenCalledWith(microphone, stream);
    incomingTrack();
    await flush();
    session.leave();
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(peerConnections[0].close).toHaveBeenCalledOnce();
    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[0].srcObject).toBeNull();
    expect(audios[0].remove).toHaveBeenCalledOnce();
    expect(state.status).toBe('idle');
    await flush();
    expect(emit).toHaveBeenCalledWith('voice:leave');
  });

  it('should stop late permission results after cancellation without ever joining the server', async () => {
    const pending = deferred<MediaStream>();
    media.mockReturnValueOnce(pending.promise);
    const joining = session.join('ABC123', 'alice');
    expect(state.status).toBe('joining');
    session.leave();
    pending.resolve(stream);
    await joining;
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(emit).not.toHaveBeenCalledWith('voice:join', expect.anything());
    expect(state.status).toBe('idle');
  });

  it('should keep a newer room join independent from a stale microphone permission result', async () => {
    const pending = deferred<MediaStream>();
    media.mockReturnValueOnce(pending.promise);
    const oldJoin = session.join('OLD123', 'alice');
    session.leave();
    const newMicrophone = makeTrack();
    media.mockResolvedValueOnce(makeStream([newMicrophone]));
    joinResult = { success: true, peerId: 'new', state: { ...room('new'), roomCode: 'NEW123' } };
    await session.join('NEW123', 'alice');
    pending.resolve(stream);
    await oldJoin;
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(newMicrophone.stop).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: 'joined', roomCode: 'NEW123', peerId: 'new' });
  });

  it('should ignore a prior leave notification while an immediate rejoin is still acquiring its microphone', async () => {
    await session.join('ABC123', 'alice');
    session.leave();
    const pending = deferred<MediaStream>();
    const nextTrack = makeTrack();
    media.mockReturnValueOnce(pending.promise);
    const joining = session.join('ABC123', 'alice');
    receive('voice:left', { reason: 'You left voice chat.' });
    expect(state.status).toBe('joining');
    await flush();
    pending.resolve(makeStream([nextTrack]));
    await joining;
    expect(state.status).toBe('joined');
    expect(nextTrack.stop).not.toHaveBeenCalled();
  });

  it('should stop capture on disconnect or device loss and never autojoin when transport reconnects', async () => {
    joinResult = { success: true, peerId: 'self', state: room('self', ['remote']) };
    await session.join('ABC123', 'alice');
    transport.connected = false;
    receive('disconnect');
    expect(state).toMatchObject({ status: 'error', error: 'disconnected' });
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(peerConnections[0].close).toHaveBeenCalledOnce();
    transport.connected = true;
    transport.id = 'socket-2';
    receive('connect');
    expect(media).toHaveBeenCalledOnce();
    const nextTrack = makeTrack();
    media.mockResolvedValueOnce(makeStream([nextTrack]));
    await session.join('ABC123', 'alice');
    nextTrack.dispatchEvent(new Event('ended'));
    expect(state).toMatchObject({ status: 'error', error: 'microphone-ended' });
    expect(nextTrack.stop).toHaveBeenCalledOnce();
  });

  it('should serialize an old disposed controller cleanup before a replacement controller joins the same socket', async () => {
    const oldAcknowledgment = deferred<VoiceJoinResult>();
    let joinCount = 0;
    emit.mockImplementation(async (event: string) => {
      if (event === 'voice:join') {
        joinCount += 1;
        return joinCount === 1
          ? oldAcknowledgment.promise
          : { success: true, peerId: 'new', state: room('new') };
      }
      if (event === 'voice:leave') receive('voice:left', { reason: 'You left voice chat.' });
      return { success: true };
    });
    const oldJoin = session.join('ABC123', 'alice');
    await flush();
    session.dispose();
    const nextTrack = makeTrack();
    media.mockResolvedValueOnce(makeStream([nextTrack]));
    session = createVoiceSession(transport as unknown as VoiceSocket, (next) => {
      state = next;
    });
    const newJoin = session.join('ABC123', 'alice');
    await flush();
    expect(joinCount).toBe(1);
    expect(state.status).toBe('joining');
    oldAcknowledgment.resolve({ success: true, peerId: 'old', state: room('old') });
    await Promise.all([oldJoin, newJoin]);
    expect(emit.mock.calls.map(([event]) => event)).toEqual([
      'voice:join',
      'voice:leave',
      'voice:join',
    ]);
    expect(state).toMatchObject({ status: 'joined', peerId: 'new' });
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(nextTrack.stop).not.toHaveBeenCalled();
  });

  it('should never send stale queued cleanup to a different socket connection after reconnect', async () => {
    const oldAcknowledgment = deferred<VoiceJoinResult>();
    let joinCount = 0;
    emit.mockImplementation(async (event: string) => {
      if (event === 'voice:join') {
        joinCount += 1;
        return joinCount === 1
          ? oldAcknowledgment.promise
          : { success: true, peerId: 'new', state: room('new') };
      }
      return { success: true };
    });
    const oldJoin = session.join('ABC123', 'alice');
    await flush();
    session.leave();
    transport.connected = false;
    receive('disconnect');
    transport.id = 'socket-2';
    transport.connected = true;
    media.mockResolvedValueOnce(makeStream([makeTrack()]));
    const newJoin = session.join('ABC123', 'alice');
    oldAcknowledgment.resolve({ success: true, peerId: 'old', state: room('old') });
    await Promise.all([oldJoin, newJoin]);
    expect(emit.mock.calls.map(([event]) => event)).toEqual(['voice:join', 'voice:join']);
    expect(state).toMatchObject({ status: 'joined', peerId: 'new' });
  });

  it('should allow a transient connection interruption and expire a peer that remains disconnected', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    joinResult = { success: true, peerId: 'self', state: room('self', ['remote']) };
    await session.join('ABC123', 'alice');
    const peer = peerConnections[0];
    peer.connectionState = 'connected';
    peer.onconnectionstatechange?.();
    peer.connectionState = 'disconnected';
    peer.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(peer.close).not.toHaveBeenCalled();
    peer.connectionState = 'connected';
    peer.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(peer.close).not.toHaveBeenCalled();
    peer.connectionState = 'disconnected';
    peer.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(peer.close).toHaveBeenCalledOnce();
    expect(state).toMatchObject({ status: 'joined', error: 'connection-failed' });
    expect(microphone.stop).not.toHaveBeenCalled();
  });

  it('should stop capture and peers when the server rejects a settings update', async () => {
    joinResult = { success: true, peerId: 'self', state: room('self', ['remote']) };
    await session.join('ABC123', 'alice');
    emit.mockImplementation(async (event: string) => ({ success: event !== 'voice:settings' }));
    session.setMuted(true);
    expect(microphone.enabled).toBe(false);
    await flush();
    expect(state).toMatchObject({ status: 'error', error: 'signal-failed' });
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(peerConnections[0].close).toHaveBeenCalledOnce();
  });

  it('should mute only microphone tracks and deafen existing and future remote audio independently', async () => {
    session.setMuted(true);
    session.setDeafened(true);
    joinResult = { success: true, peerId: 'self', state: room('self', ['remote']) };
    await session.join('ABC123', 'alice');
    expect(microphone.enabled).toBe(false);
    incomingTrack();
    expect(audios[0].muted).toBe(true);
    receive('voice:state', room('self', ['remote', 'remote2']));
    incomingTrack(1);
    expect(audios[1].muted).toBe(true);
    session.setDeafened(false);
    expect(audios.every((audio) => !audio.muted)).toBe(true);
    expect(microphone.enabled).toBe(false);
    session.setMuted(false);
    expect(microphone.enabled).toBe(true);
    expect(audios.every((audio) => !audio.muted)).toBe(true);
    await flush();
    expect(emit).toHaveBeenCalledWith('voice:settings', { muted: false, deafened: false });
  });

  it('should buffer ICE before SDP, answer only the designated offerer and discard stale peer signals', async () => {
    joinResult = { success: true, peerId: 'z-self', state: room('z-self', ['a-remote']) };
    await session.join('ABC123', 'alice');
    const peer = peerConnections[0];
    expect(peer.createOffer).not.toHaveBeenCalled();
    const candidate = { candidate: 'candidate-data', sdpMid: '0', sdpMLineIndex: 0 };
    receive('voice:signal', { fromPeerId: 'a-remote', candidate });
    await flush();
    expect(peer.addIceCandidate).not.toHaveBeenCalled();
    receive('voice:signal', {
      fromPeerId: 'a-remote',
      description: { type: 'offer', sdp: 'remote-offer' },
    });
    await flush();
    expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'remote-offer' });
    expect(peer.addIceCandidate).toHaveBeenCalledWith(candidate);
    expect(emit).toHaveBeenCalledWith('voice:signal', {
      targetPeerId: 'a-remote',
      description: { type: 'answer', sdp: 'local-answer' },
    });
    receive('voice:state', room('z-self'));
    receive('voice:signal', {
      fromPeerId: 'a-remote',
      description: { type: 'offer', sdp: 'stale' },
    });
    await flush();
    expect(peer.setRemoteDescription).toHaveBeenCalledTimes(1);
    expect(peerConnections).toHaveLength(1);
  });

  it('should send a single deterministic offer and serialize an answer received before its signal acknowledgment', async () => {
    joinResult = { success: true, peerId: 'a-self', state: room('a-self', ['z-remote']) };
    const signalAck = deferred<{ success: boolean }>();
    emit.mockImplementation(async (event: string) =>
      event === 'voice:join'
        ? joinResult
        : event === 'voice:signal'
          ? signalAck.promise
          : { success: true },
    );
    await session.join('ABC123', 'alice');
    await flush();
    receive('voice:signal', {
      fromPeerId: 'z-remote',
      description: { type: 'answer', sdp: 'remote-answer' },
    });
    await flush();
    expect(peerConnections[0].setRemoteDescription).not.toHaveBeenCalled();
    signalAck.resolve({ success: true });
    await flush();
    expect(peerConnections[0].createOffer).toHaveBeenCalledOnce();
    expect(peerConnections[0].setRemoteDescription).toHaveBeenCalledWith({
      type: 'answer',
      sdp: 'remote-answer',
    });
  });

  it('should accept state and offers that arrive before the join acknowledgment', async () => {
    const pendingJoin = deferred<VoiceJoinResult>();
    emit.mockImplementation(async (event: string) =>
      event === 'voice:join' ? pendingJoin.promise : { success: true },
    );
    const joining = session.join('ABC123', 'alice');
    await flush();
    receive('voice:state', room('z-self', ['a-remote']));
    receive('voice:signal', {
      fromPeerId: 'a-remote',
      description: { type: 'offer', sdp: 'early-offer' },
    });
    pendingJoin.resolve({ success: true, peerId: 'z-self', state: room('z-self') });
    await joining;
    await flush();
    expect(peerConnections[0].setRemoteDescription).toHaveBeenCalledWith({
      type: 'offer',
      sdp: 'early-offer',
    });
  });

  it('should expose blocked playback and resume it on another explicit user gesture', async () => {
    joinResult = { success: true, peerId: 'self', state: room('self', ['remote']) };
    await session.join('ABC123', 'alice');
    audios[0].play.mockRejectedValueOnce(new Error('User gesture required'));
    incomingTrack();
    await flush();
    expect(state.autoplayBlocked).toBe(true);
    await session.resumeAudio();
    expect(state.autoplayBlocked).toBe(false);
    expect(audios[0].play).toHaveBeenCalledTimes(2);
  });

  it('should keep signaling failures local to the failed peer and stop it without affecting game transport', async () => {
    joinResult = { success: true, peerId: 'a-self', state: room('a-self', ['z-remote']) };
    emit.mockImplementation(async (event: string) =>
      event === 'voice:join' ? joinResult : { success: false },
    );
    await session.join('ABC123', 'alice');
    await flush();
    expect(state).toMatchObject({ status: 'joined', error: 'signal-failed' });
    expect(peerConnections[0].close).toHaveBeenCalledOnce();
    expect(microphone.stop).not.toHaveBeenCalled();
    expect(transport.connected).toBe(true);
  });

  it('should clean up when join is rejected and map permission/device failures to actionable errors', async () => {
    joinResult = { success: false, error: 'Already joined in another tab.' };
    await session.join('ABC123', 'alice');
    expect(state).toMatchObject({ status: 'error', error: 'join-failed' });
    expect(microphone.stop).toHaveBeenCalledOnce();
    for (const [name, error] of [
      ['NotAllowedError', 'permission'],
      ['NotFoundError', 'no-microphone'],
      ['NotReadableError', 'microphone-busy'],
    ]) {
      media.mockRejectedValueOnce({ name });
      await session.join('ABC123', 'alice');
      expect(state.error).toBe(error);
    }
  });

  it('should reject unsupported/insecure browsers and invalid ICE configuration before requesting the microphone', async () => {
    vi.stubGlobal('isSecureContext', false);
    await session.join('ABC123', 'alice');
    expect(state.error).toBe('insecure');
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('RTCPeerConnection', undefined);
    await session.join('ABC123', 'alice');
    expect(state.error).toBe('unsupported');
    vi.stubGlobal('RTCPeerConnection', vi.fn());
    session.dispose();
    session = createVoiceSession(
      transport as unknown as VoiceSocket,
      (next) => {
        state = next;
      },
      { iceServers: () => parseIceServers('bad json') },
    );
    await session.join('ABC123', 'alice');
    expect(state.error).toBe('configuration');
    expect(media).not.toHaveBeenCalled();
  });

  it('should detach listeners and ignore late media and signaling after disposal', async () => {
    const pending = deferred<MediaStream>();
    media.mockReturnValueOnce(pending.promise);
    const joining = session.join('ABC123', 'alice');
    session.dispose();
    pending.resolve(stream);
    await joining;
    receive('voice:signal', {
      fromPeerId: 'stale',
      description: { type: 'offer', sdp: 'ignored' },
    } satisfies VoiceIncomingSignal);
    expect([...listeners.values()].every((handlers) => handlers.size === 0)).toBe(true);
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(peerConnections).toHaveLength(0);
  });
});

describe('ICE server configuration', () => {
  it('should use the default STUN endpoint and accept bounded STUN/TURN settings', () => {
    expect(parseIceServers()).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
    expect(
      parseIceServers(
        JSON.stringify([
          {
            urls: ['stun:example.com', 'turns:relay.example.com:443?transport=tcp'],
            username: 'short-lived',
            credential: 'public-client-token',
          },
        ]),
      ),
    ).toEqual([
      {
        urls: ['stun:example.com', 'turns:relay.example.com:443?transport=tcp'],
        username: 'short-lived',
        credential: 'public-client-token',
      },
    ]);
  });

  it('should reject malformed, unsafe or unbounded server entries instead of silently falling back', () => {
    for (const input of [
      '',
      'null',
      '{}',
      '[]',
      JSON.stringify([{ urls: 'https://example.com' }]),
      JSON.stringify([{ urls: 'stun:bad host' }]),
      JSON.stringify([{ urls: [], username: 'x' }]),
      JSON.stringify(Array.from({ length: 9 }, () => ({ urls: 'stun:example.com' }))),
      JSON.stringify([{ urls: Array.from({ length: 17 }, () => 'stun:example.com') }]),
      JSON.stringify([{ urls: 'turn:example.com', credential: {} }]),
    ]) {
      expect(() => parseIceServers(input)).toThrow();
    }
  });
});

import { createMusicSamples } from './music-loop';
import type { TrackDefinition } from './music-loop';

const SAMPLE_RATE = 22_050;
const FADE_SECONDS = 1.5;

export interface BackgroundMusic {
  /** Resume, or crossfade to `track`. With `loops`, the track ends (and `onTrackEnd` fires) after that many loops. */
  play: (track: TrackDefinition, loops: number | null) => Promise<void>;
  pause: () => Promise<void>;
  setVolume: (volume: number) => void;
  dispose: () => void;
}

interface Voice {
  trackId: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
  endsAt: number | null;
}

/** Own one audio graph for the entire app; allocate it only after a play gesture. */
export function createBackgroundMusic(
  onPlayingChange: (playing: boolean) => void,
  onTrackEnd: () => void = () => undefined,
): BackgroundMusic {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let current: Voice | null = null;
  const fading = new Set<Voice>();
  const buffers = new Map<string, AudioBuffer>();
  let volume = 0.25;
  let disposed = false;

  const release = (voice: Voice): void => {
    voice.source.onended = null;
    voice.source.disconnect();
    voice.gain.disconnect();
    fading.delete(voice);
  };

  const scheduleEnd = (audio: AudioContext, voice: Voice, loops: number): void => {
    const duration = voice.source.buffer?.duration ?? 0;
    const played = Math.ceil((audio.currentTime + FADE_SECONDS - voice.startedAt) / duration);
    voice.endsAt = voice.startedAt + Math.max(loops, played) * duration;
    voice.gain.gain.setValueAtTime(1, voice.endsAt - FADE_SECONDS);
    voice.gain.gain.linearRampToValueAtTime(0, voice.endsAt);
    voice.source.stop(voice.endsAt);
    voice.source.onended = (): void => {
      release(voice);
      if (current !== voice) return;
      current = null;
      onTrackEnd();
    };
  };

  const start = (audio: AudioContext, track: TrackDefinition, loops: number | null): void => {
    let buffer = buffers.get(track.id);
    if (!buffer) {
      const samples = createMusicSamples(SAMPLE_RATE, track);
      buffer = audio.createBuffer(1, samples.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
      buffers.set(track.id, buffer);
    }
    const now = audio.currentTime;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
    gain.connect(master!);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    const voice: Voice = { trackId: track.id, source, gain, startedAt: now, endsAt: null };
    try {
      source.start(now);
    } catch (error) {
      release(voice);
      throw error;
    }
    const previous = current;
    current = voice;
    if (previous) {
      fading.add(previous);
      previous.source.onended = (): void => release(previous);
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
      previous.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
      previous.source.stop(now + FADE_SECONDS);
    }
    if (loops !== null) scheduleEnd(audio, voice, loops);
  };

  const play = async (track: TrackDefinition, loops: number | null): Promise<void> => {
    if (disposed) return;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = volume;
      master.connect(context.destination);
      context.onstatechange = (): void => onPlayingChange(context?.state === 'running');
    }
    const audio = context;
    await audio.resume();
    if (disposed) return;
    if (current?.trackId !== track.id) start(audio, track, loops);
    // ponytail: a scheduled stop cannot be cancelled; switching to loop-one replays the track when it ends.
    else if (loops !== null && current.endsAt === null) scheduleEnd(audio, current, loops);
    onPlayingChange(audio.state === 'running');
  };

  return {
    play,
    async pause(): Promise<void> {
      if (disposed) return;
      await context?.suspend();
      if (!disposed) onPlayingChange(false);
    },
    setVolume(value: number): void {
      volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : volume;
      if (context && master && !disposed) {
        master.gain.setTargetAtTime(volume, context.currentTime, 0.04);
      }
    },
    dispose(): void {
      disposed = true;
      if (context) {
        context.onstatechange = null;
        for (const voice of [...fading, ...(current ? [current] : [])]) {
          release(voice);
          try { voice.source.stop(); } catch { /* Already stopped by its schedule. */ }
        }
        master?.disconnect();
        void context.close().catch(() => undefined);
      }
      context = null;
      current = null;
      master = null;
      buffers.clear();
    },
  };
}

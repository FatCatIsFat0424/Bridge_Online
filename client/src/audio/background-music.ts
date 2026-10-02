import { createMusicSamples } from './music-loop';

export interface BackgroundMusic {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  setVolume: (volume: number) => void;
  dispose: () => void;
}

/** Own one audio graph for the entire app; allocate it only after a play gesture. */
export function createBackgroundMusic(onPlayingChange: (playing: boolean) => void): BackgroundMusic {
  let context: AudioContext | null = null;
  let gain: GainNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let sourceStarted = false;
  let volume = 0.25;
  let disposed = false;

  const play = async (): Promise<void> => {
    if (disposed) return;
    if (!context) {
      context = new AudioContext();
      gain = context.createGain();
      gain.gain.value = volume;
      gain.connect(context.destination);
      context.onstatechange = (): void => onPlayingChange(context?.state === 'running');
    }
    await context.resume();
    if (disposed) return;
    if (!source) {
      const samples = createMusicSamples(22_050);
      const buffer = context.createBuffer(1, samples.length, 22_050);
      buffer.getChannelData(0).set(samples);
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain!);
      source.start();
      sourceStarted = true;
    }
    onPlayingChange(context.state === 'running');
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
      if (context && gain && !disposed) {
        gain.gain.setTargetAtTime(volume, context.currentTime, 0.04);
      }
    },
    dispose(): void {
      disposed = true;
      if (context) {
        context.onstatechange = null;
        if (sourceStarted) source?.stop();
        source?.disconnect();
        gain?.disconnect();
        void context.close().catch(() => undefined);
      }
      context = null;
      source = null;
      sourceStarted = false;
      gain = null;
    },
  };
}

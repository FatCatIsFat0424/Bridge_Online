export interface TurnSound {
  ready: () => boolean;
  unlock: () => void;
  play: () => void;
  stop: () => void;
  dispose: () => void;
}

/** A short original two-note cue, independent of the music player. */
export function createTurnSound(): TurnSound {
  let context: AudioContext | null = null;
  let disposed = false;
  const voices = new Set<() => void>();
  const stop = (): void => {
    for (const release of voices) release();
  };
  return {
    ready: () => !disposed && context?.state === 'running',
    unlock: () => {
      if (disposed) return;
      try {
        if (!context) context = new AudioContext();
        if (context.state === 'suspended') void context.resume().catch(() => undefined);
      } catch { /* Audio support and permission are optional. */ }
    },
    play: () => {
      if (disposed || context?.state !== 'running') return;
      stop();
      try {
        for (const [offset, frequency] of [[0, 660], [0.12, 880]]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const release = (): void => {
            oscillator.onended = null;
            try { oscillator.stop(); } catch { /* The voice may have already ended. */ }
            oscillator.disconnect();
            gain.disconnect();
            voices.delete(release);
          };
          voices.add(release);
          oscillator.onended = release;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          const start = context.currentTime + offset;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.18);
        }
      } catch { stop(); }
    },
    stop,
    dispose: () => {
      disposed = true;
      stop();
      try { void context?.close().catch(() => undefined); } catch { /* Already closed. */ }
      context = null;
    },
  };
}

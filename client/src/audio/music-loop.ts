const BEAT_SECONDS = 60 / 84;
const CHORDS = [
  [48, 60, 64, 67, 71],
  [45, 60, 64, 67, 69],
  [41, 57, 60, 64, 67],
  [43, 59, 62, 64, 67],
] as const;
const MELODY = [1, 3, 2, 4, 3, 2, 4, 2] as const;

/** Original, quiet four-chord instrumental. Note tails wrap for a seamless loop. */
export function createMusicSamples(sampleRate: number): Float32Array {
  const length = Math.round(32 * BEAT_SECONDS * sampleRate);
  const dry = new Float32Array(length);

  const addNote = (midi: number, beat: number, bass: boolean): void => {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const duration = (bass ? 3.8 : 2.4) * BEAT_SECONDS;
    const start = Math.round(beat * BEAT_SECONDS * sampleRate);
    const count = Math.ceil(duration * sampleRate);
    for (let frame = 0; frame < count; frame += 1) {
      const time = frame / sampleRate;
      const phase = 2 * Math.PI * frequency * time;
      const attack = Math.min(1, time / 0.018);
      const release = Math.min(1, (duration - time) / 0.16);
      const envelope = attack * release * Math.exp(-time / (bass ? 1.25 : 0.65));
      const tone = Math.sin(phase) + 0.2 * Math.sin(2 * phase) + 0.06 * Math.sin(3 * phase);
      dry[(start + frame) % length] += tone * envelope * (bass ? 0.11 : 0.085);
    }
  };

  CHORDS.forEach((chord, bar) => {
    addNote(chord[0], bar * 8, true);
    addNote(chord[0], bar * 8 + 4, true);
    MELODY.forEach((degree, beat) => addNote(chord[degree], bar * 8 + beat, false));
  });

  const samples = new Float32Array(length);
  const delay = Math.round(BEAT_SECONDS * 1.5 * sampleRate);
  for (let frame = 0; frame < length; frame += 1) {
    samples[frame] = dry[frame]
      + 0.22 * dry[(frame - delay + length) % length]
      + 0.1 * dry[(frame - delay * 2 + length) % length];
  }
  return samples;
}

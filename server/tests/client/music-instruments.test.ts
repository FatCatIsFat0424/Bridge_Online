import { describe, expect, it } from 'vitest';
import { createMusicSamples, type Instrument, type TrackDefinition } from '../../../client/src/audio/music-loop';
import { KOTO, SHAMISEN, SHAKUHACHI, SHINOBUE, TAIKO, SHIME_DAIKO, SUZU } from '../../../client/src/audio/japanese-instruments';

const SAMPLE_RATE = 8000;
const BASE: Instrument = {
  harmonics: [1], attack: 0.001, decay: 10, release: 0.01, duration: 2, gain: 0.1,
};

function render(instrument: Instrument): Float32Array {
  const track = {
    id: 'test', genre: 'japanese', energy: 'calm', title: { en: 'Test', 'zh-TW': 'Test' },
    bpm: 60, chords: [[69]], chordBeats: 2,
    parts: [{ instrument, steps: [0], stepBeats: 2 }], echo: { beats: 0, taps: [] },
  } satisfies TrackDefinition;
  return createMusicSamples(SAMPLE_RATE, track);
}

function energy(samples: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let frame = start; frame < end; frame += 1) sum += samples[frame] ** 2;
  return sum / (end - start);
}

function difference(a: Float32Array, b: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let frame = start; frame < end; frame += 1) sum += (a[frame] - b[frame]) ** 2;
  return sum / (end - start);
}

describe('Japanese instrument synthesis', () => {
  it('should fade transient noise independently of sustained notes', () => {
    const steady = render({ ...BASE, harmonics: [], noise: 1 });
    const transient = render({ ...BASE, harmonics: [], noise: 1, noiseDecay: 0.05 });
    expect(energy(transient, 4000, 6000)).toBeLessThan(energy(steady, 4000, 6000) * 0.001);
    expect(energy(transient, 10, 200)).toBeGreaterThan(0);
  });

  it('should lose upper harmonics while retaining the fundamental', () => {
    const fundamental = render(BASE);
    const bright = render({ ...BASE, harmonics: [1, 1, 1], brightnessDecay: 0.05 });
    expect(difference(bright, fundamental, 20, 300)).toBeGreaterThan(0.001);
    expect(difference(bright, fundamental, 4000, 6000)).toBeLessThan(1e-10);
  });

  it('should delay vibrato without changing the note onset', () => {
    const steady = render(BASE);
    const vibrato = render({ ...BASE, vibrato: { rate: 5, depth: 30, delay: 0.3 } });
    expect(difference(steady, vibrato, 0, 2400)).toBe(0);
    expect(difference(steady, vibrato, 4000, 6000)).toBeGreaterThan(0.001);
  });

  it('should reject resonant modes at and above Nyquist', () => {
    const silent = render({ ...BASE, harmonics: [], partials: [{ ratio: 10, amplitude: 1 }] });
    expect(silent.every((value) => value === 0)).toBe(true);
    const resonant = render({ ...BASE, harmonics: [], partials: [{ ratio: 1.47, amplitude: 1 }] });
    expect(energy(resonant, 100, 4000)).toBeGreaterThan(0.001);
  });

  it('should render seven distinct finite deterministic timbres', () => {
    const presets = [KOTO, SHAMISEN, SHAKUHACHI, SHINOBUE, TAIKO, SHIME_DAIKO, SUZU];
    const samples = presets.map(render);
    for (let index = 0; index < presets.length; index += 1) {
      expect(samples[index].every(Number.isFinite)).toBe(true);
      expect(samples[index]).toEqual(render(presets[index]));
      expect(energy(samples[index], 0, 2000)).toBeGreaterThan(0);
      for (let previous = 0; previous < index; previous += 1) {
        expect(difference(samples[index], samples[previous], 0, 2000)).toBeGreaterThan(1e-5);
      }
    }
  });
});

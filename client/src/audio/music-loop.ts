import type { MusicEnergy, MusicGenre } from './music-categories';

export interface Instrument {
  /** Amplitude of each partial (index 0 = fundamental). */
  harmonics: readonly number[];
  attack: number;
  /** Exponential decay time constant in seconds. */
  decay: number;
  release: number;
  /** Note length in beats. */
  duration: number;
  gain: number;
  /** 0 = pure tone, 1 = pure noise. */
  noise?: number;
  /** Start frequency multiplier that falls back to 1 (drum pitch drop). */
  sweep?: number;
  /** Exponential noise decay time constant in seconds. */
  noiseDecay?: number;
  /** Seconds for upper harmonics to fade toward the fundamental. */
  brightnessDecay?: number;
  /** Rate in Hz, depth in cents, onset delay in seconds. Applies to harmonic tones. */
  vibrato?: { rate: number; depth: number; delay: number };
  /** Additional resonant modes; ratios need not be integer harmonics. */
  partials?: readonly { ratio: number; amplitude: number; decay?: number }[];
}

/** A step is a palette index, several indices (chord), or a rest. */
export type Step = number | readonly number[] | null;

export interface Part {
  instrument: Instrument;
  /** Repeated cyclically across the whole loop, one entry per `stepBeats`. */
  steps: readonly Step[];
  stepBeats: number;
  /** Fixed MIDI pitch for every hit instead of the chord palette (drums). */
  pitch?: number;
  octave?: number;
}

export interface TrackDefinition {
  id: string;
  genre: MusicGenre;
  energy: MusicEnergy;
  title: { 'zh-TW': string; en: string };
  bpm: number;
  /** Ascending MIDI note palettes; indices past the end wrap up an octave. */
  chords: readonly (readonly number[])[];
  chordBeats: number;
  parts: readonly Part[];
  /** Delay in beats applied to off-beat eighths. */
  swing?: number;
  echo: { beats: number; taps: readonly number[] };
}

const PEAK_LIMIT = 0.9;
const WAVETABLE_SIZE = 4096;

export function trackBeats(track: TrackDefinition): number {
  return track.chords.length * track.chordBeats;
}

/** Original, procedurally synthesized loop. Note tails and echoes wrap for a seamless loop. */
export function createMusicSamples(sampleRate: number, track: TrackDefinition): Float32Array {
  const beatSeconds = 60 / track.bpm;
  const totalBeats = trackBeats(track);
  const length = Math.round(totalBeats * beatSeconds * sampleRate);
  const dry = new Float32Array(length);
  let seed = 0x2545f491;
  const random = (): number => {
    seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
    return seed / 0x80000000 - 1;
  };

  const renderNote = (midi: number, instrument: Instrument): Float32Array => {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const duration = Math.min(instrument.duration * beatSeconds, instrument.attack + instrument.decay * 7);
    const note = new Float32Array(Math.min(length, Math.ceil(duration * sampleRate)));
    const noise = instrument.noise ?? 0;
    const sweep = instrument.sweep ?? 0;
    const wave = new Float32Array(WAVETABLE_SIZE);
    const dark = instrument.brightnessDecay ? new Float32Array(WAVETABLE_SIZE) : undefined;
    const evolving = instrument.noiseDecay || instrument.brightnessDecay || instrument.vibrato
      || instrument.partials;
    const maximumFrequency = evolving
      ? frequency * (1 + Math.max(0, sweep)) * 2 ** (Math.abs(instrument.vibrato?.depth ?? 0) / 1200)
      : frequency;
    instrument.harmonics.forEach((amplitude, index) => {
      if (amplitude === 0 || maximumFrequency * (index + 1) >= sampleRate / 2) return;
      for (let slot = 0; slot < WAVETABLE_SIZE; slot += 1) {
        wave[slot] += amplitude * Math.sin(2 * Math.PI * (index + 1) * slot / WAVETABLE_SIZE);
      }
    });
    if (dark && maximumFrequency < sampleRate / 2) {
      for (let slot = 0; slot < WAVETABLE_SIZE; slot += 1) {
        dark[slot] = (instrument.harmonics[0] ?? 0)
          * Math.sin(2 * Math.PI * slot / WAVETABLE_SIZE);
      }
    }
    const modes = (instrument.partials ?? [])
      .filter((partial) => partial.ratio > 0 && frequency * partial.ratio < sampleRate / 2)
      .map((partial) => {
        const angle = 2 * Math.PI * frequency * partial.ratio / sampleRate;
        return {
          sine: 0, cosine: 1, rotationSine: Math.sin(angle), rotationCosine: Math.cos(angle),
          amplitude: partial.amplitude,
          fall: partial.decay ? Math.exp(-1 / (sampleRate * partial.decay)) : 1,
        };
      });
    const noiseFall = instrument.noiseDecay ? Math.exp(-1 / (sampleRate * instrument.noiseDecay)) : 1;
    const brightnessFall = instrument.brightnessDecay
      ? Math.exp(-1 / (sampleRate * instrument.brightnessDecay)) : 1;
    let noiseLevel = noise;
    let brightness = 1;
    const vibrato = instrument.vibrato;
    const vibratoAngle = 2 * Math.PI * (vibrato?.rate ?? 0) / sampleRate;
    const vibratoSine = Math.sin(vibratoAngle);
    const vibratoCosine = Math.cos(vibratoAngle);
    let modulationSine = 0;
    let modulationCosine = 1;
    const step = frequency * WAVETABLE_SIZE / sampleRate;
    const fall = Math.exp(-1 / (sampleRate * instrument.decay));
    const sweepFall = Math.exp(-1 / (sampleRate * 0.04));
    let decay = instrument.gain;
    let bend = sweep;
    let phase = 0;
    for (let frame = 0; frame < note.length; frame += 1) {
      const time = frame / sampleRate;
      const envelope = Math.min(1, time / instrument.attack, (duration - time) / instrument.release) * decay;
      const slot = Math.floor(phase) & (WAVETABLE_SIZE - 1);
      let tone = dark ? dark[slot] + (wave[slot] - dark[slot]) * brightness : wave[slot];
      for (const mode of modes) {
        tone += mode.sine * mode.amplitude;
        const sine = mode.sine * mode.rotationCosine + mode.cosine * mode.rotationSine;
        mode.cosine = mode.cosine * mode.rotationCosine - mode.sine * mode.rotationSine;
        mode.sine = sine;
        mode.amplitude *= mode.fall;
      }
      note[frame] = (noise === 0 ? tone : tone * (1 - noise) + random() * noiseLevel) * envelope;
      let pitchRatio = 1;
      if (vibrato && time >= vibrato.delay) {
        // A short onset ramp avoids an abrupt pitch change as vibrato enters.
        const depth = vibrato.depth * Math.min(1, (time - vibrato.delay) / 0.15);
        pitchRatio = 2 ** (modulationSine * depth / 1200);
        const sine = modulationSine * vibratoCosine + modulationCosine * vibratoSine;
        modulationCosine = modulationCosine * vibratoCosine - modulationSine * vibratoSine;
        modulationSine = sine;
      }
      phase += step * (1 + bend) * pitchRatio;
      noiseLevel *= noiseFall;
      brightness *= brightnessFall;
      if (phase >= WAVETABLE_SIZE) phase -= WAVETABLE_SIZE;
      decay *= fall;
      bend *= sweepFall;
    }
    return note;
  };

  // Patterns repeat, so each (instrument, pitch) is rendered once and mixed in at every hit.
  const rendered = new Map<Instrument, Map<number, Float32Array>>();
  const addNote = (midi: number, beat: number, instrument: Instrument): void => {
    const notes = rendered.get(instrument) ?? new Map<number, Float32Array>();
    rendered.set(instrument, notes);
    const note = notes.get(midi) ?? renderNote(midi, instrument);
    notes.set(midi, note);
    const start = Math.round(beat * beatSeconds * sampleRate) % length;
    const head = Math.min(note.length, length - start);
    for (let frame = 0; frame < head; frame += 1) dry[start + frame] += note[frame];
    for (let frame = head; frame < note.length; frame += 1) dry[frame - head] += note[frame];
  };

  for (const part of track.parts) {
    const stepCount = Math.round(totalBeats / part.stepBeats);
    for (let index = 0; index < stepCount; index += 1) {
      const step = part.steps[index % part.steps.length];
      if (step === null) continue;
      let beat = index * part.stepBeats;
      if (track.swing && beat % 1 === 0.5) beat += track.swing;
      const chord = track.chords[Math.floor(index * part.stepBeats / track.chordBeats)];
      for (const degree of typeof step === 'number' ? [step] : step) {
        const midi = part.pitch ?? chord[degree % chord.length] + 12 * Math.floor(degree / chord.length);
        addNote(midi + 12 * (part.octave ?? 0), beat, part.instrument);
      }
    }
  }

  const samples = new Float32Array(length);
  const delay = Math.round(track.echo.beats * beatSeconds * sampleRate);
  let peak = 0;
  for (let frame = 0; frame < length; frame += 1) {
    let value = dry[frame];
    for (let tap = 0; tap < track.echo.taps.length; tap += 1) {
      value += track.echo.taps[tap] * dry[(((frame - delay * (tap + 1)) % length) + length) % length];
    }
    samples[frame] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak > PEAK_LIMIT) {
    for (let frame = 0; frame < length; frame += 1) samples[frame] *= PEAK_LIMIT / peak;
  }
  return samples;
}

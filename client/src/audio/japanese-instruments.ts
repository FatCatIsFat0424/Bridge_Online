import type { Instrument } from './music-loop';

export const KOTO: Instrument = {
  harmonics: [1, 0.58, 0.32, 0.2, 0.12, 0.07],
  attack: 0.003, decay: 0.48, release: 0.18, duration: 2, gain: 0.1,
  noise: 0.045, noiseDecay: 0.018, brightnessDecay: 0.12,
};

export const SHAMISEN: Instrument = {
  harmonics: [0.75, 0.55, 0.72, 0.28, 0.4, 0.16, 0.2],
  attack: 0.002, decay: 0.2, release: 0.08, duration: 1, gain: 0.075,
  noise: 0.22, noiseDecay: 0.025, brightnessDecay: 0.08,
};

export const SHAKUHACHI: Instrument = {
  harmonics: [1, 0.15, 0.09, 0.035],
  attack: 0.13, decay: 2.4, release: 0.25, duration: 3, gain: 0.085,
  noise: 0.16, noiseDecay: 1.2, brightnessDecay: 0.4,
  vibrato: { rate: 4.6, depth: 24, delay: 0.3 },
};

export const SHINOBUE: Instrument = {
  harmonics: [0.85, 0.38, 0.13, 0.07],
  attack: 0.055, decay: 1.6, release: 0.14, duration: 1.6, gain: 0.065,
  noise: 0.055, noiseDecay: 0.35,
  vibrato: { rate: 5.7, depth: 15, delay: 0.2 },
};

export const TAIKO: Instrument = {
  harmonics: [1, 0.32, 0.09],
  attack: 0.002, decay: 0.19, release: 0.08, duration: 0.8, gain: 0.15,
  sweep: 0.9, noise: 0.18, noiseDecay: 0.025, brightnessDecay: 0.035,
};

export const SHIME_DAIKO: Instrument = {
  harmonics: [0.7, 0.42, 0.2, 0.1],
  attack: 0.001, decay: 0.085, release: 0.045, duration: 0.4, gain: 0.09,
  sweep: 0.4, noise: 0.55, noiseDecay: 0.035, brightnessDecay: 0.025,
};

export const SUZU: Instrument = {
  harmonics: [0.45],
  attack: 0.001, decay: 0.65, release: 0.22, duration: 2.5, gain: 0.055,
  partials: [
    { ratio: 1.47, amplitude: 0.5, decay: 0.8 },
    { ratio: 2.09, amplitude: 0.34, decay: 0.55 },
    { ratio: 2.56, amplitude: 0.27, decay: 0.32 },
    { ratio: 3.78, amplitude: 0.14, decay: 0.16 },
  ],
};

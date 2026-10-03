import type { Instrument, TrackDefinition } from './music-loop';
import { KOTO, SHAMISEN, SHAKUHACHI, SUZU } from './japanese-instruments';

const KICK: Instrument = {
  harmonics: [1], attack: 0.002, decay: 0.11, release: 0.03,
  duration: 0.8, gain: 0.23, sweep: 3,
};
const SNARE: Instrument = {
  harmonics: [1, 0.3], noise: 0.8, attack: 0.001, decay: 0.08,
  release: 0.02, duration: 0.45, gain: 0.1,
};
const HAT: Instrument = {
  harmonics: [], noise: 1, attack: 0.001, decay: 0.018,
  release: 0.008, duration: 0.2, gain: 0.035,
};
const BASS: Instrument = {
  harmonics: [1, 0.25, 0.1], attack: 0.004, decay: 0.23,
  release: 0.04, duration: 0.7, gain: 0.13,
};

/** Original motifs arranged for the additive synthesizer; no recorded samples. */
export const NEW_MUSIC_TRACKS: readonly TrackDefinition[] = [
  {
    id: 'alley-sparks',
    title: { 'zh-TW': '巷口火花', en: 'Alley Sparks' },
    genre: 'punk', energy: 'energetic', bpm: 174,
    chords: [
      [40, 47, 52, 59, 64], [40, 47, 52, 59, 64],
      [43, 50, 55, 62, 67], [45, 52, 57, 64, 69],
      [40, 47, 52, 59, 64], [43, 50, 55, 62, 67],
      [45, 52, 57, 64, 69], [47, 54, 59, 66, 71],
    ],
    chordBeats: 4,
    parts: [
      {
        instrument: {
          harmonics: [1, 0.65, 0.48, 0.3, 0.23, 0.16], attack: 0.003,
          decay: 0.22, release: 0.02, duration: 0.42, gain: 0.055,
        },
        steps: [[0, 1, 2], 0, [0, 1, 2], 0, [0, 1, 2], null, [1, 2, 3], [0, 1, 2]],
        stepBeats: 0.5,
      },
      { instrument: BASS, steps: [0, 0, 0, 0, 0, 0, 1, 0], stepBeats: 0.5, octave: -1 },
      { instrument: KICK, pitch: 35, steps: [0, null, null, 0, 0, 0, null, null], stepBeats: 0.5 },
      { instrument: SNARE, pitch: 48, steps: [null, 0], stepBeats: 1 },
      { instrument: HAT, pitch: 0, steps: [0], stepBeats: 0.5 },
      {
        instrument: { ...SNARE, gain: 0.055 }, pitch: 48, stepBeats: 0.5,
        steps: [null, null, null, null, null, null, null, null,
          null, null, null, null, null, 0, 0, 0],
      },
    ],
    echo: { beats: 1, taps: [] },
  },
  {
    id: 'sugar-comet',
    title: { 'zh-TW': '糖果彗星', en: 'Sugar Comet' },
    genre: 'kawaii-edm', energy: 'energetic', bpm: 144,
    chords: [[48, 60, 64, 67, 72, 76, 79, 81], [45, 57, 60, 64, 69, 72, 76, 79],
      [41, 53, 57, 60, 65, 69, 72, 76], [43, 55, 59, 62, 67, 71, 74, 79]],
    chordBeats: 8,
    parts: [
      {
        instrument: {
          harmonics: [1, 0.15, 0.4, 0.08, 0.12], attack: 0.003, decay: 0.2,
          release: 0.04, duration: 0.4, gain: 0.075,
        },
        steps: [4, null, 6, 5, null, 4, 7, null, 6, 5, null, 4, 5, null, null, null,
          4, 5, 6, null, 7, null, 6, 5, 6, null, 4, null, 5, 4, null, null],
        stepBeats: 0.25,
      },
      {
        instrument: { ...BASS, harmonics: [1, 0.5, 0.22], duration: 0.4 },
        steps: [0, null, null, 0, null, 1, 0, null], stepBeats: 0.5,
      },
      {
        instrument: { ...BASS, gain: 0.025, decay: 0.12, duration: 0.3 },
        steps: [null, [1, 2, 3], null, null, [2, 3, 4], null, null, [1, 2, 3]],
        stepBeats: 0.5,
      },
      { instrument: KICK, pitch: 36, steps: [0, null, null, 0, 0, null, 0, null], stepBeats: 0.5 },
      { instrument: SNARE, pitch: 52, steps: [null, 0], stepBeats: 1 },
      { instrument: HAT, pitch: 0, steps: [null, 0, null, 0, null, 0, 0, 0], stepBeats: 0.25 },
    ],
    echo: { beats: 0.75, taps: [0.12, 0.05] },
  },
  {
    id: 'tidal-glass',
    title: { 'zh-TW': '潮汐微光', en: 'Tidal Glass' },
    genre: 'ambient', energy: 'calm', bpm: 58,
    chords: [[38, 50, 57, 64, 69], [41, 53, 60, 64, 69],
      [36, 48, 55, 62, 67], [43, 50, 57, 62, 69]],
    chordBeats: 8,
    parts: [
      {
        instrument: {
          harmonics: [1, 0.08, 0.025], attack: 1.8, decay: 8,
          release: 2.5, duration: 11, gain: 0.045,
        },
        steps: [[1, 2, 3]], stepBeats: 8,
      },
      {
        instrument: {
          harmonics: [1], attack: 1.2, decay: 5, release: 2, duration: 8, gain: 0.1,
        },
        steps: [0], stepBeats: 8,
      },
      {
        instrument: {
          harmonics: [1, 0, 0.05], attack: 0.8, decay: 2.8,
          release: 1.4, duration: 5, gain: 0.055,
        },
        steps: [4, null, 3, null, null, 4, null, 2], stepBeats: 2, octave: 1,
      },
    ],
    echo: { beats: 2.5, taps: [0.3, 0.18, 0.08] },
  },
  {
    id: 'pocket-orbit',
    title: { 'zh-TW': '口袋軌道', en: 'Pocket Orbit' },
    genre: 'chiptune', energy: 'steady', bpm: 112,
    chords: [[48, 55, 60, 64, 67, 69, 72], [43, 50, 55, 59, 62, 64, 67],
      [45, 52, 57, 60, 64, 67, 69], [41, 48, 53, 57, 60, 62, 65],
      [48, 55, 60, 64, 67, 69, 72], [40, 47, 52, 55, 59, 62, 64],
      [41, 48, 53, 57, 60, 62, 65], [43, 50, 55, 59, 62, 65, 67]],
    chordBeats: 4,
    parts: [
      {
        instrument: {
          harmonics: [1, 0.7, 0.33, 0, -0.2, -0.23, -0.14],
          attack: 0.002, decay: 1, release: 0.015, duration: 0.7, gain: 0.055,
        },
        steps: [3, null, 5, 4, null, 3, 2, null, 4, null, 6, null, 5, 4, 3, null,
          2, 3, null, 4, 5, null, 4, null, 3, null, 2, 3, 4, null, null, null],
        stepBeats: 0.5, octave: 1,
      },
      {
        instrument: {
          harmonics: [1, 0, -1 / 9, 0, 1 / 25], attack: 0.002, decay: 1,
          release: 0.015, duration: 0.85, gain: 0.13,
        },
        steps: [0, null, 1, 2, 0, 1, null, 1], stepBeats: 0.5,
      },
      { instrument: { ...KICK, decay: 0.06 }, pitch: 40, steps: [0, null, null, 0], stepBeats: 1 },
      {
        instrument: { ...HAT, decay: 0.06, duration: 0.3, gain: 0.07 },
        pitch: 0, steps: [null, 0], stepBeats: 1,
      },
    ],
    echo: { beats: 1, taps: [] },
  },
  {
    id: 'clover-jig',
    title: { 'zh-TW': '三葉草吉格舞', en: 'Clover Jig' },
    genre: 'celtic', energy: 'steady', bpm: 180,
    // Six eighth-note pulses form two dotted-quarter groups per bar.
    chords: [[50, 57, 62, 64, 66, 69, 71, 74], [55, 62, 67, 69, 71, 74, 76, 79],
      [50, 57, 62, 64, 66, 69, 71, 74], [57, 64, 69, 71, 73, 76, 78, 81],
      [55, 62, 67, 69, 71, 74, 76, 79], [50, 57, 62, 64, 66, 69, 71, 74]],
    chordBeats: 6,
    parts: [
      {
        instrument: {
          harmonics: [1, 0.08, 0.05], attack: 0.025, decay: 0.9,
          release: 0.07, duration: 0.9, gain: 0.08,
        },
        steps: [2, 3, 4, 5, 4, 3, 4, 5, 6, 5, 3, 4,
          5, 6, 7, 6, 5, 4, 3, 4, 5, 4, 3, 2], stepBeats: 1,
      },
      {
        instrument: {
          harmonics: [1, 0.45, 0.18], attack: 0.004, decay: 0.2,
          release: 0.06, duration: 1.3, gain: 0.045,
        },
        steps: [[0, 1], null, 2, [1, 4], null, 2], stepBeats: 1,
      },
      {
        instrument: { ...KICK, gain: 0.095, sweep: 0.7, noise: 0.12 },
        pitch: 43, steps: [0, null, null, 0, null, null], stepBeats: 1,
      },
      {
        instrument: { ...HAT, decay: 0.035, gain: 0.025 },
        pitch: 0, steps: [null, null, 0, null, 0, 0], stepBeats: 1,
      },
    ],
    echo: { beats: 1.5, taps: [0.09] },
  },
  {
    id: 'moonlit-courtyard',
    title: { 'zh-TW': '月下庭院', en: 'Moonlit Courtyard' },
    genre: 'japanese', energy: 'calm', bpm: 82,
    // A shared D-E-flat-G-A-B-flat pentatonic collection avoids Western triadic cadences.
    chords: [[38, 50, 51, 55, 57, 58, 62, 63], [43, 50, 51, 55, 57, 58, 62, 63],
      [45, 50, 51, 55, 57, 58, 62, 63], [38, 50, 51, 55, 57, 58, 62, 63]],
    chordBeats: 8,
    parts: [
      {
        instrument: { ...KOTO, gain: 0.085 },
        steps: [1, null, 4, null, 5, 4, null, 3, 2, null, null, null, 3, 4, null, null,
          6, null, 7, 6, null, 5, 4, null, 3, null, 2, null, 1, null, null, null],
        stepBeats: 0.5, octave: 1,
      },
      {
        instrument: { ...SHAMISEN, decay: 0.5, gain: 0.06 },
        steps: [0, null, null, 1, null, 3, 2, null], stepBeats: 1,
      },
      {
        instrument: { ...SHAKUHACHI, duration: 3, gain: 0.05 },
        steps: [null, null, 4, null, null, 3, null, 1], stepBeats: 2,
      },
      {
        instrument: { ...SUZU, gain: 0.025 },
        pitch: 83, steps: [null, null, null, 0, null, null, null, null], stepBeats: 2,
      },
    ],
    echo: { beats: 0.75, taps: [0.15, 0.07] },
  },
  {
    id: 'velvet-platform',
    title: { 'zh-TW': '午夜月台', en: 'Velvet Platform' },
    genre: 'house', energy: 'energetic', bpm: 124,
    chords: [[41, 53, 56, 60, 63, 67], [44, 56, 60, 63, 67, 70],
      [39, 51, 55, 58, 62, 65], [46, 58, 61, 65, 68, 72]],
    chordBeats: 8,
    parts: [
      { instrument: { ...KICK, decay: 0.16, gain: 0.28 }, pitch: 34, steps: [0], stepBeats: 1 },
      { instrument: HAT, pitch: 0, steps: [null, 0], stepBeats: 0.5 },
      {
        instrument: { ...SNARE, noise: 1, decay: 0.055, gain: 0.07 },
        pitch: 0, steps: [null, 0], stepBeats: 1,
      },
      {
        instrument: { ...BASS, harmonics: [1, 0.12], duration: 0.4 },
        steps: [null, 0, null, 0, null, 1, null, 0], stepBeats: 0.5,
      },
      {
        instrument: {
          harmonics: [1, 0.35, 0.15, 0.05], attack: 0.006, decay: 0.16,
          release: 0.045, duration: 0.55, gain: 0.035,
        },
        steps: [null, [1, 2, 3, 4], null, null, null, null, [2, 3, 4, 5], null],
        stepBeats: 0.5,
      },
      {
        instrument: {
          harmonics: [1, 0.12], attack: 0.01, decay: 0.35,
          release: 0.08, duration: 0.7, gain: 0.04,
        },
        steps: [null, null, 5, null, null, 4, null, null,
          null, 3, null, null, 4, null, null, null], stepBeats: 0.5, octave: 1,
      },
    ],
    echo: { beats: 0.75, taps: [0.08] },
  },
];

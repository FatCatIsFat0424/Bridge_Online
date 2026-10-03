import type { TrackDefinition } from './music-loop';
import { KOTO, SHAMISEN, SHAKUHACHI, SHINOBUE, TAIKO, SHIME_DAIKO, SUZU } from './japanese-instruments';

/** Original Japanese-inspired arrangements using contrasting scales and phrasing. */
export const JAPANESE_MUSIC_TRACKS: readonly TrackDefinition[] = [
  {
    id: 'lantern-procession',
    title: { 'zh-TW': '燈火祭典', en: 'Lantern Procession' },
    genre: 'japanese', energy: 'energetic', bpm: 132,
    // D-E-G-A-B forms a bright festival pentatonic collection over changing bass tones.
    chords: [[38, 50, 52, 55, 57, 59, 62, 64], [43, 50, 52, 55, 57, 59, 62, 64],
      [45, 50, 52, 55, 57, 59, 62, 64], [38, 50, 52, 55, 57, 59, 62, 64]],
    chordBeats: 8,
    parts: [
      {
        instrument: { ...SHINOBUE, duration: 0.8, gain: 0.085 },
        steps: [3, 4, 5, null, 6, 5, 4, 3, 4, null, 2, 3, 4, 3, null, null,
          6, 6, 5, 4, 5, null, 4, 3, 2, 3, 4, null, 3, null, 1, null],
        stepBeats: 0.5, octave: 1,
      },
      {
        instrument: { ...SHAMISEN, duration: 0.7, gain: 0.07 },
        steps: [[1, 4], null, 3, 4, null, 2, 3, null,
          [1, 4], null, 4, null, 3, 2, 1, null], stepBeats: 0.5,
      },
      { instrument: TAIKO, pitch: 38, steps: [0, null, null, 0, 0, null, 0, null,
        0, null, 0, null, null, 0, 0, null], stepBeats: 0.5 },
      {
        instrument: SHIME_DAIKO,
        pitch: 55, steps: [null, 0, null, 0, null, 0, 0, 0], stepBeats: 0.5,
      },
      {
        instrument: { ...SUZU, gain: 0.025, duration: 1.2 },
        pitch: 81, steps: [0, null, null, null, null, null, 0, null], stepBeats: 1,
      },
    ],
    echo: { beats: 0.5, taps: [0.07] },
  },
  {
    id: 'rain-on-paper',
    title: { 'zh-TW': '紙窗聽雨', en: 'Rain on Paper' },
    genre: 'japanese', energy: 'calm', bpm: 68,
    // A-B-C-E-F gives the plucked line close semitone resolutions.
    chords: [[45, 57, 59, 60, 64, 65, 69, 71], [41, 57, 59, 60, 64, 65, 69, 71],
      [40, 57, 59, 60, 64, 65, 69, 71], [45, 57, 59, 60, 64, 65, 69, 71]],
    chordBeats: 8,
    parts: [
      {
        instrument: { ...KOTO, decay: 1.1, brightnessDecay: 0.12, gain: 0.075 },
        steps: [4, null, 5, 4, null, null, 3, null, 2, null, null, 1, null, null, null, null,
          3, null, 4, null, 6, null, 5, 4, null, null, 3, 2, 1, null, null, null],
        stepBeats: 0.5,
      },
      {
        instrument: { ...KOTO, decay: 1.8, duration: 4, gain: 0.085 },
        steps: [0, null, 1, null], stepBeats: 2,
      },
      {
        instrument: { ...SHAKUHACHI, decay: 2.2, duration: 4, gain: 0.06 },
        steps: [null, null, null, 4, null, null, 3, null,
          null, 2, null, null, null, 1, null, null], stepBeats: 2,
      },
      {
        instrument: {
          harmonics: [], noise: 1, attack: 0.008, decay: 0.015,
          release: 0.015, duration: 0.15, gain: 0.018,
        },
        pitch: 0, stepBeats: 0.5,
        steps: [null, 0, null, null, 0, null, 0, null, null, null, 0, null, 0, null, null, 0],
      },
    ],
    echo: { beats: 1.5, taps: [0.24, 0.12] },
  },
  {
    id: 'petals-on-the-river',
    title: { 'zh-TW': '花瓣逐水', en: 'Petals on the River' },
    genre: 'japanese', energy: 'steady', bpm: 108,
    // G-A-B-D-E supports a flowing three-beat spring dance.
    chords: [[43, 55, 57, 59, 62, 64, 67, 69], [40, 55, 57, 59, 62, 64, 67, 69],
      [48, 55, 57, 59, 62, 64, 67, 69], [50, 55, 57, 59, 62, 64, 67, 69],
      [43, 55, 57, 59, 62, 64, 67, 69], [43, 55, 57, 59, 62, 64, 67, 69]],
    chordBeats: 6,
    parts: [
      {
        instrument: { ...SHINOBUE, attack: 0.04, decay: 0.8, duration: 1.2, gain: 0.065 },
        steps: [3, null, 4, 5, 4, 3, 2, null, 1, 2, 3, null,
          4, 5, 6, null, 5, 4, 3, null, 2, 3, 1, null],
        stepBeats: 0.5, octave: 1,
      },
      {
        instrument: { ...KOTO, gain: 0.065, decay: 0.45 },
        steps: [0, 2, 4, 1, 3, 5, 0, 3, 4, 1, 5, 3], stepBeats: 0.5,
      },
      {
        instrument: { ...TAIKO, gain: 0.065, decay: 0.12, sweep: 0.2 },
        pitch: 48, steps: [0, null, null], stepBeats: 1,
      },
      {
        instrument: { ...SUZU, gain: 0.02, duration: 2 },
        pitch: 79, steps: [null, null, 0, null, null, null], stepBeats: 1,
      },
      {
        instrument: { ...SHAMISEN, gain: 0.04 },
        steps: [null, null, 3, null, 2, null, null, null, 4, null, 3, null],
        stepBeats: 0.5,
      },
    ],
    echo: { beats: 0.75, taps: [0.12] },
  },
  {
    id: 'moss-and-stillness',
    title: { 'zh-TW': '苔庭靜息', en: 'Moss and Stillness' },
    genre: 'japanese', energy: 'calm', bpm: 54,
    // E-F-A-B-D hangs above an open fifth drone with long, unmetered-feeling rests.
    chords: [[40, 52, 53, 57, 59, 62, 64, 65], [40, 52, 53, 57, 59, 62, 64, 65],
      [45, 52, 53, 57, 59, 62, 64, 65], [40, 52, 53, 57, 59, 62, 64, 65]],
    chordBeats: 8,
    parts: [
      {
        instrument: {
          harmonics: [1, 0.025], attack: 1.7, decay: 8,
          release: 2.4, duration: 10, gain: 0.065,
        },
        steps: [[0, 4]], stepBeats: 8,
      },
      {
        instrument: { ...SHAKUHACHI, attack: 0.4, decay: 2.8, release: 1, duration: 4.5 },
        steps: [1, null, null, 2, null, 4, null, null,
          5, null, null, 4, null, 2, 1, null], stepBeats: 2,
      },
      {
        instrument: { ...KOTO, brightnessDecay: 0.15, decay: 1.8, duration: 5, gain: 0.045 },
        steps: [null, null, 6, null, null, null, null, 4,
          null, null, null, 3, null, 2, null, null], stepBeats: 2,
      },
    ],
    echo: { beats: 2.5, taps: [0.25, 0.13, 0.06] },
  },
];

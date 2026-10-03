import { NEW_MUSIC_TRACKS } from './new-music-tracks';
import { JAPANESE_MUSIC_TRACKS } from './japanese-music-tracks';
import type { Instrument, TrackDefinition } from './music-loop';

export type MusicMode = 'loop-one' | 'sequential' | 'shuffle';

const chord = (root: number, intervals: readonly number[]): number[] => intervals.map((step) => root + step);

const MAJ7_WALK = [0, 4, 7, 9, 16, 19, 23, 24, 26, 28];
const MIN7_WALK = [0, 3, 7, 10, 15, 19, 22, 24, 26, 27];
const DOM7_WALK = [0, 4, 7, 10, 16, 19, 22, 24, 26, 28];
const MAJ_ARP = [0, 7, 12, 16, 19, 24, 28, 31, 36];
const MIN_ARP = [0, 7, 12, 15, 19, 24, 27, 31, 36];
const MAJ7_ARP = [0, 7, 12, 16, 19, 23, 24, 28, 31];
const DOM_ARP = [0, 7, 12, 16, 19, 22, 24, 28, 31];
const MAJ_PENTA = [0, 7, 12, 16, 19, 21, 24, 26, 28, 31];
const MIN_PENTA = [0, 7, 12, 15, 19, 22, 24, 26, 27, 31];
const MAJ9 = [0, 12, 16, 19, 23, 26, 28, 31];
const MIN9 = [0, 12, 15, 19, 22, 26, 27, 31];
const DOM9 = [0, 12, 16, 19, 22, 26, 28, 31];

const SQUARE_PARTIALS = [1, 0, 1 / 3, 0, 1 / 5, 0, 1 / 7, 0, 1 / 9];

const KICK: Instrument = {
  harmonics: [1], attack: 0.002, decay: 0.12, release: 0.03, duration: 1, gain: 0.3, sweep: 3,
};
const SNARE: Instrument = {
  harmonics: [1, 0.5], noise: 0.75, attack: 0.001, decay: 0.09, release: 0.02, duration: 0.5, gain: 0.12,
};
const HAT: Instrument = {
  harmonics: [], noise: 1, attack: 0.001, decay: 0.02, release: 0.01, duration: 0.25, gain: 0.05,
};
const PLUCK_BASS: Instrument = {
  harmonics: [1, 0.45, 0.2], attack: 0.004, decay: 0.22, release: 0.03, duration: 0.5, gain: 0.12,
};

export const MUSIC_TRACKS: readonly TrackDefinition[] = [
  {
    id: 'table-breeze',
    genre: 'chill', energy: 'calm',
    title: { 'zh-TW': '牌桌晚風', en: 'Table Breeze' },
    bpm: 84,
    chords: [[48, 60, 64, 67, 71], [45, 60, 64, 67, 69], [41, 57, 60, 64, 67], [43, 59, 62, 64, 67]],
    chordBeats: 8,
    parts: [
      {
        instrument: { harmonics: [1, 0.2, 0.06], attack: 0.018, decay: 1.25, release: 0.16, duration: 3.8, gain: 0.11 },
        steps: [0], stepBeats: 4,
      },
      {
        instrument: { harmonics: [1, 0.2, 0.06], attack: 0.018, decay: 0.65, release: 0.16, duration: 2.4, gain: 0.085 },
        steps: [1, 3, 2, 4, 3, 2, 4, 2], stepBeats: 1,
      },
    ],
    echo: { beats: 1.5, taps: [0.22, 0.1] },
  },
  {
    id: 'teahouse-swing',
    genre: 'jazz', energy: 'steady',
    title: { 'zh-TW': '茶館爵士', en: 'Teahouse Swing' },
    bpm: 126,
    swing: 0.16,
    chords: [
      chord(41, MAJ7_WALK), chord(38, MIN7_WALK), chord(43, MIN7_WALK), chord(36, DOM7_WALK),
      chord(45, MIN7_WALK), chord(38, DOM7_WALK), chord(43, MIN7_WALK), chord(36, DOM7_WALK),
      chord(41, MAJ7_WALK), chord(41, DOM7_WALK), chord(46, MAJ7_WALK), chord(46, MIN7_WALK),
      chord(45, MIN7_WALK), chord(38, DOM7_WALK), chord(43, MIN7_WALK), chord(36, DOM7_WALK),
    ],
    chordBeats: 4,
    parts: [
      {
        instrument: { harmonics: [1, 0.5, 0.2], attack: 0.01, decay: 0.35, release: 0.05, duration: 0.95, gain: 0.13 },
        steps: [0, 1, 2, 3, 0, 2, 3, 1], stepBeats: 1,
      },
      {
        instrument: { harmonics: [1, 0.25, 0.08], attack: 0.006, decay: 0.3, release: 0.06, duration: 0.8, gain: 0.035 },
        steps: [null, [4, 5, 6], null, null, null, null, [4, 6, 7], null], stepBeats: 0.5,
      },
      {
        instrument: { harmonics: [1, 0.3, 0.1, 0.05], attack: 0.01, decay: 0.5, release: 0.08, duration: 0.9, gain: 0.06 },
        octave: 1, stepBeats: 0.5,
        steps: [
          7, null, 6, 5, 4, null, 5, null, 6, null, null, 8, 7, null, null, null,
          9, 8, 7, null, 6, null, 5, null, 4, 5, 6, 7, 8, null, null, null,
          null, null, 7, 6, 5, null, 4, null, 5, null, 6, null, 7, null, null, null,
          8, null, 9, 8, 7, null, 6, 5, 4, null, null, null, null, null, null, null,
        ],
      },
      { instrument: { ...HAT, decay: 0.12, duration: 0.5, gain: 0.02 }, pitch: 0, steps: [0, null, 0, 0], stepBeats: 0.5 },
      { instrument: { ...HAT, decay: 0.07, gain: 0.025 }, pitch: 0, steps: [null, 0], stepBeats: 1 },
      { instrument: { ...KICK, gain: 0.08 }, pitch: 36, steps: [0], stepBeats: 1 },
    ],
    echo: { beats: 0.75, taps: [0.12] },
  },
  {
    id: 'rainy-night',
    genre: 'piano', energy: 'calm',
    title: { 'zh-TW': '雨夜鋼琴', en: 'Rainy Night Piano' },
    bpm: 66,
    chords: [
      chord(45, MIN_ARP), chord(41, MAJ7_ARP), chord(48, MAJ_ARP), chord(43, MAJ_ARP),
      chord(45, MIN_ARP), chord(40, MIN_ARP), chord(41, MAJ7_ARP), chord(40, DOM_ARP),
    ],
    chordBeats: 8,
    parts: [
      {
        instrument: { harmonics: [1, 0.22, 0.07, 0.02], attack: 0.012, decay: 1.2, release: 0.2, duration: 3, gain: 0.065 },
        steps: [0, 2, 3, 4, 5, 4, 3, 2, 1, 3, 4, 5, 6, 5, 4, 3], stepBeats: 0.5,
      },
      {
        instrument: { harmonics: [1, 0.15, 0.04], attack: 0.01, decay: 0.9, release: 0.2, duration: 3, gain: 0.07 },
        steps: [8, null, null, 7, 6, null, 5, null, 6, null, null, null, 5, null, null, null], stepBeats: 1,
      },
      {
        instrument: { ...HAT, decay: 0.015, gain: 0.012 }, pitch: 0, stepBeats: 0.25,
        steps: [0, null, 0, null, null, 0, 0, null, 0, null, null, 0, null, 0, null, null],
      },
    ],
    echo: { beats: 0.75, taps: [0.3, 0.18, 0.1] },
  },
  {
    id: 'night-market',
    genre: 'electronic', energy: 'energetic',
    title: { 'zh-TW': '夜市', en: 'Night Market' },
    bpm: 138,
    chords: [
      chord(38, MAJ_PENTA), chord(47, MIN_PENTA), chord(43, MAJ_PENTA), chord(45, MAJ_PENTA),
      chord(38, MAJ_PENTA), chord(47, MIN_PENTA), chord(43, MAJ_PENTA), chord(45, MAJ_PENTA),
      chord(47, MIN_PENTA), chord(43, MAJ_PENTA), chord(38, MAJ_PENTA), chord(45, MAJ_PENTA),
      chord(43, MAJ_PENTA), chord(45, MAJ_PENTA), chord(38, MAJ_PENTA), chord(38, MAJ_PENTA),
    ],
    chordBeats: 4,
    parts: [
      { instrument: PLUCK_BASS, steps: [0, null, 2, null, 0, 0, 2, null], stepBeats: 0.5 },
      {
        instrument: { harmonics: [1, 0.5, 0.33, 0.25, 0.2, 0.1], attack: 0.004, decay: 0.25, release: 0.04, duration: 0.5, gain: 0.05 },
        octave: 1, stepBeats: 0.5,
        steps: [
          6, null, 5, 4, 5, null, 3, null, 6, 7, 6, 5, 4, null, null, null,
          3, null, 4, 5, 6, null, 8, 7, 6, null, 5, null, 4, null, null, null,
        ],
      },
      {
        instrument: { harmonics: [1, 0.3, 0.1], attack: 0.003, decay: 0.12, release: 0.03, duration: 0.4, gain: 0.025 },
        steps: [null, [2, 3, 4]], stepBeats: 0.5,
      },
      { instrument: KICK, pitch: 36, steps: [0], stepBeats: 1 },
      { instrument: SNARE, pitch: 50, steps: [null, 0], stepBeats: 1 },
      { instrument: HAT, pitch: 0, steps: [null, 0], stepBeats: 0.5 },
    ],
    echo: { beats: 0.75, taps: [0.15] },
  },
  {
    id: 'arcade',
    genre: 'chiptune', energy: 'energetic',
    title: { 'zh-TW': '8-bit 街機', en: '8-bit Arcade' },
    bpm: 150,
    chords: [
      chord(40, MIN_ARP), chord(48, MAJ_ARP), chord(50, MAJ_ARP), chord(47, MAJ_ARP),
      chord(40, MIN_ARP), chord(48, MAJ_ARP), chord(50, MAJ_ARP), chord(40, MIN_ARP),
      chord(45, MIN_ARP), chord(40, MIN_ARP), chord(48, MAJ_ARP), chord(47, MAJ_ARP),
      chord(40, MIN_ARP), chord(48, MAJ_ARP), chord(47, MAJ_ARP), chord(40, MIN_ARP),
    ],
    chordBeats: 4,
    parts: [
      {
        instrument: { harmonics: SQUARE_PARTIALS, attack: 0.002, decay: 1.5, release: 0.01, duration: 0.25, gain: 0.035 },
        steps: [2, 3, 4, 5, 4, 3, 2, 3], stepBeats: 0.25,
      },
      {
        instrument: { harmonics: SQUARE_PARTIALS, attack: 0.002, decay: 1.5, release: 0.02, duration: 0.45, gain: 0.05 },
        octave: 1, stepBeats: 0.5,
        steps: [
          4, null, 4, 5, 6, null, 5, 4, 3, null, null, 4, 5, null, null, null,
          6, 6, 7, null, 6, 5, 4, null, 5, null, 3, null, 4, null, null, null,
        ],
      },
      {
        instrument: { harmonics: [1, 0, 1 / 9, 0, 1 / 25], attack: 0.003, decay: 1, release: 0.02, duration: 0.45, gain: 0.14 },
        steps: [0, 2], stepBeats: 0.5,
      },
      { instrument: { ...KICK, harmonics: [1, 0, 1 / 9] }, pitch: 33, steps: [0, null, null, null, null, null, 0, null], stepBeats: 0.25 },
      { instrument: { ...HAT, gain: 0.04 }, pitch: 0, steps: [0, null, 0, 0], stepBeats: 0.25 },
      { instrument: { ...HAT, decay: 0.08, duration: 0.5, gain: 0.09 }, pitch: 0, steps: [null, 0], stepBeats: 1 },
    ],
    echo: { beats: 1, taps: [] },
  },
  {
    id: 'tense-table',
    genre: 'cinematic', energy: 'steady',
    title: { 'zh-TW': '牌局緊張', en: 'Tense Table' },
    bpm: 104,
    chords: [
      chord(38, MIN_ARP), chord(46, MAJ_ARP), chord(43, MIN_ARP), chord(45, DOM_ARP),
      chord(38, MIN_ARP), chord(39, MAJ_ARP), chord(38, MIN_ARP), chord(45, DOM_ARP),
    ],
    chordBeats: 8,
    parts: [
      {
        instrument: { harmonics: [1, 0.6, 0.35, 0.2, 0.1], attack: 0.005, decay: 0.18, release: 0.03, duration: 0.45, gain: 0.12 },
        steps: [0, 0, 0, 0, 0, 0, 2, 0], stepBeats: 0.5,
      },
      {
        instrument: { harmonics: [1, 0.4, 0.25, 0.12], attack: 0.9, decay: 6, release: 1.2, duration: 8, gain: 0.03 },
        steps: [[2, 3, 4]], stepBeats: 8,
      },
      {
        instrument: { harmonics: [1, 0.3, 0.1], attack: 0.004, decay: 0.2, release: 0.04, duration: 0.5, gain: 0.05 },
        octave: 1, stepBeats: 0.5,
        steps: [5, null, null, null, 4, null, null, null, 5, null, 6, null, 5, null, null, null],
      },
      { instrument: KICK, pitch: 33, steps: [0, 0, null, null, null, null, null, null], stepBeats: 0.5 },
      { instrument: { ...HAT, gain: 0.02 }, pitch: 0, steps: [0], stepBeats: 0.5 },
    ],
    echo: { beats: 0.75, taps: [0.2, 0.08] },
  },
  {
    id: 'lofi-afternoon',
    genre: 'lofi', energy: 'calm',
    title: { 'zh-TW': 'lo-fi 午後', en: 'Lo-fi Afternoon' },
    bpm: 76,
    swing: 0.12,
    chords: [
      chord(48, MIN9), chord(41, DOM9), chord(46, MAJ9), chord(43, MIN9),
      chord(39, MAJ9), chord(50, DOM9), chord(43, MIN9), chord(48, DOM9),
    ],
    chordBeats: 8,
    parts: [
      {
        instrument: { harmonics: [1, 0.3, 0.08, 0.03], attack: 0.015, decay: 1.4, release: 0.3, duration: 3, gain: 0.035 },
        steps: [[1, 2, 3, 4], null, null, [2, 3, 4, 5], null, null, null, null], stepBeats: 1,
      },
      {
        instrument: { harmonics: [1, 0.25], attack: 0.01, decay: 0.6, release: 0.1, duration: 1.5, gain: 0.12 },
        steps: [0, null, null, null, null, null, 0, null, 0, null, null, 1, null, null, null, null], stepBeats: 0.5,
      },
      {
        instrument: { harmonics: [1, 0.4, 0.1], attack: 0.01, decay: 0.7, release: 0.15, duration: 1.5, gain: 0.045 },
        stepBeats: 0.5,
        steps: [
          null, null, 5, null, 4, null, 3, null, null, null, null, null, null, null, null, null,
          null, null, 4, 5, 6, null, 5, null, 4, null, null, null, null, null, null, null,
        ],
      },
      { instrument: { ...KICK, gain: 0.22 }, pitch: 36, steps: [0, null, null, null, null, 0, null, null], stepBeats: 0.5 },
      { instrument: { ...SNARE, gain: 0.07 }, pitch: 50, steps: [null, 0], stepBeats: 1 },
      { instrument: { ...HAT, gain: 0.025 }, pitch: 0, steps: [0], stepBeats: 0.5 },
      {
        instrument: { ...HAT, decay: 0.004, gain: 0.02 }, pitch: 0, stepBeats: 0.25,
        steps: [0, null, null, null, null, null, 0, null, null, null, null, 0, null, null, null, null],
      },
    ],
    echo: { beats: 1, taps: [0.2, 0.08] },
  },
  ...NEW_MUSIC_TRACKS,
  ...JAPANESE_MUSIC_TRACKS,
];

/** Index of the track to play next; `loop-one` stays put, shuffle never repeats the current track. */
export function nextTrackIndex(
  current: number,
  count: number,
  mode: MusicMode,
  random: () => number,
  direction: 1 | -1 = 1,
): number {
  if (count <= 1 || mode === 'loop-one') return Math.max(0, Math.min(current, count - 1));
  if (mode === 'sequential') return (current + direction + count) % count;
  const pick = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return pick >= current ? pick + 1 : pick;
}

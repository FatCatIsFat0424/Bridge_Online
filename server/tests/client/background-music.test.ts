import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundMusic } from '../../../client/src/audio/background-music';
import { createMusicSamples, trackBeats } from '../../../client/src/audio/music-loop';
import { MUSIC_TRACKS, nextTrackIndex } from '../../../client/src/audio/music-tracks';
import { MUSIC_ENERGIES, MUSIC_GENRES } from '../../../client/src/audio/music-categories';

const TRACK = MUSIC_TRACKS[0];

interface MockSource {
  buffer: { duration: number } | null; loop: boolean; onended: (() => void) | null;
  connect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function makeSource(): MockSource {
  return {
    buffer: null, loop: false, onended: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(),
  };
}

function mockAudio(): {
  context: ReturnType<typeof makeContext>;
  construct: ReturnType<typeof vi.fn>;
} {
  const context = makeContext();
  const construct = vi.fn(function () { return context; });
  vi.stubGlobal('AudioContext', construct);
  return { context, construct };
}

function makeContext(): {
  state: string; currentTime: number; destination: object; onstatechange: null;
  gain: { gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn>; setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>; cancelScheduledValues: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  source: MockSource; sources: MockSource[];
  createGain: ReturnType<typeof vi.fn>; createBufferSource: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn<() => Promise<void>>>;
  suspend: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>;
} {
  const gain = {
    gain: {
      value: 1, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(), disconnect: vi.fn(),
  };
  const source = makeSource();
  const sources: MockSource[] = [];
  return {
    state: 'running', currentTime: 0, destination: {}, onstatechange: null,
    gain, source, sources,
    createGain: vi.fn(() => gain),
    createBufferSource: vi.fn(() => {
      const next = sources.length === 0 ? source : makeSource();
      sources.push(next);
      return next;
    }),
    createBuffer: vi.fn((_channels: number, length: number, rate: number) => ({
      duration: length / rate,
      getChannelData: (): Float32Array => new Float32Array(length),
    })),
    resume: vi.fn(async (): Promise<void> => undefined),
    suspend: vi.fn(async (): Promise<void> => undefined),
    close: vi.fn(async (): Promise<void> => undefined),
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('background music', () => {
  it('keeps five or more distinct Japanese-inspired compositions in the catalog', () => {
    const tracks = MUSIC_TRACKS.filter((track) => track.genre === 'japanese');
    expect(tracks.length).toBeGreaterThanOrEqual(5);
    expect(new Set(tracks.map((track) => track.id)).size).toBe(tracks.length);
    expect(tracks.some((track) => track.id === 'moonlit-courtyard')).toBe(true);
    expect(new Set(tracks.map((track) => track.energy)).size).toBe(3);
  });

  it('includes original additions for all seven requested styles with bilingual attributes', () => {
    const originalIds = new Set(['table-breeze', 'teahouse-swing', 'rainy-night', 'night-market',
      'arcade', 'tense-table', 'lofi-afternoon']);
    const additions = MUSIC_TRACKS.filter((track) => !originalIds.has(track.id));
    expect(new Set(additions.map((track) => track.genre))).toEqual(new Set([
      'punk', 'kawaii-edm', 'ambient', 'chiptune', 'celtic', 'japanese', 'house',
    ]));
    for (const track of MUSIC_TRACKS) {
      for (const locale of ['zh-TW', 'en'] as const) {
        expect(track.title[locale]).not.toHaveLength(0);
        expect(MUSIC_GENRES[track.genre][locale]).not.toHaveLength(0);
        expect(MUSIC_ENERGIES[track.energy][locale]).not.toHaveLength(0);
      }
    }
  });

  it('allocates no audio until play and reuses one loop across pause/resume', async () => {
    const { context, construct } = mockAudio();
    const changed = vi.fn();
    const player = createBackgroundMusic(changed);
    player.setVolume(0.4);
    expect(construct).not.toHaveBeenCalled();
    await player.play(TRACK, null);
    expect(context.gain.gain.value).toBe(0.4);
    expect(context.source.loop).toBe(true);
    expect(changed).toHaveBeenLastCalledWith(true);
    await player.pause();
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenLastCalledWith(false);
    await player.play(TRACK, null);
    expect(construct).toHaveBeenCalledOnce();
    expect(context.createBuffer).toHaveBeenCalledOnce();
    expect(context.source.start).toHaveBeenCalledOnce();
    player.dispose();
    expect(context.source.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('clamps volume and supports zero without rebuilding audio', async () => {
    const { context } = mockAudio();
    const player = createBackgroundMusic(vi.fn());
    await player.play(TRACK, null);
    player.setVolume(0);
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.04);
    player.setVolume(2);
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, 0.04);
    player.setVolume(-5);
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.04);
    expect(context.createBuffer).toHaveBeenCalledOnce();
    player.dispose();
  });

  it('does not start a loop if disposed while browser resume is pending', async () => {
    const { context } = mockAudio();
    let finish: (() => void) | undefined;
    context.resume.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const player = createBackgroundMusic(vi.fn());
    const playing = player.play(TRACK, null);
    player.dispose();
    finish?.();
    await playing;
    expect(context.source.start).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('surfaces browser playback rejection without starting a source', async () => {
    const { context } = mockAudio();
    context.resume.mockRejectedValueOnce(new Error('Playback denied'));
    const player = createBackgroundMusic(vi.fn());
    await expect(player.play(TRACK, null)).rejects.toThrow('Playback denied');
    expect(context.source.start).not.toHaveBeenCalled();
    player.dispose();
  });

  it('closes resources after source startup fails without stopping an unstarted source', async () => {
    const { context } = mockAudio();
    context.source.start.mockImplementationOnce(() => { throw new Error('Source failed'); });
    const player = createBackgroundMusic(vi.fn());
    await expect(player.play(TRACK, null)).rejects.toThrow('Source failed');
    player.dispose();
    expect(context.source.stop).not.toHaveBeenCalled();
    expect(context.source.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('does not notify an unmounted player after a pending pause completes', async () => {
    const { context } = mockAudio();
    let finish: (() => void) | undefined;
    context.suspend.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const changed = vi.fn();
    const player = createBackgroundMusic(changed);
    await player.play(TRACK, null);
    const paused = player.pause();
    player.dispose();
    changed.mockClear();
    finish?.();
    await paused;
    expect(changed).not.toHaveBeenCalled();
  });

  it('crossfades to a new track and fades the old one out', async () => {
    const { context } = mockAudio();
    const player = createBackgroundMusic(vi.fn());
    await player.play(MUSIC_TRACKS[0], null);
    context.currentTime = 10;
    await player.play(MUSIC_TRACKS[1], null);
    expect(context.sources).toHaveLength(2);
    expect(context.source.stop).toHaveBeenCalledWith(11.5);
    expect(context.sources[1].start).toHaveBeenCalledWith(10);
    expect(context.createBuffer).toHaveBeenCalledTimes(2);
    player.dispose();
    expect(context.sources[1].stop).toHaveBeenCalledOnce();
  });

  it('ends a track after the requested loops and reports it once', async () => {
    const { context } = mockAudio();
    const ended = vi.fn();
    const player = createBackgroundMusic(vi.fn(), ended);
    await player.play(TRACK, 2);
    const duration = Math.round(trackBeats(TRACK) * 60 / TRACK.bpm * 22_050) / 22_050;
    expect(context.source.stop).toHaveBeenCalledWith(2 * duration);
    context.source.onended?.();
    expect(ended).toHaveBeenCalledOnce();
    expect(context.source.disconnect).toHaveBeenCalledOnce();
    player.dispose();
  });

  it('schedules an end for the playing track when looping turns off', async () => {
    const { context } = mockAudio();
    const player = createBackgroundMusic(vi.fn());
    await player.play(TRACK, null);
    expect(context.source.stop).not.toHaveBeenCalled();
    await player.play(TRACK, 2);
    expect(context.source.stop).toHaveBeenCalledOnce();
    expect(context.sources).toHaveLength(1);
    player.dispose();
  });

  it('keeps the original track length and a continuous loop boundary', () => {
    const samples = createMusicSamples(22_050, TRACK);
    expect(samples.length).toBe(Math.round(32 * 60 / 84 * 22_050));
    expect(Math.abs(samples[0] - samples[samples.length - 1])).toBeLessThan(0.01);
  });

  it('generates every track as finite, audible, unclipped and distinct audio', () => {
    expect(MUSIC_TRACKS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(MUSIC_TRACKS.map((track) => track.id)).size).toBe(MUSIC_TRACKS.length);
    const fingerprints = new Set<string>();
    for (const track of MUSIC_TRACKS) {
      const started = performance.now();
      const samples = createMusicSamples(22_050, track);
      expect(performance.now() - started, track.id).toBeLessThan(500);
      let peak = 0;
      let energy = 0;
      let finite = true;
      for (const sample of samples) {
        finite = finite && Number.isFinite(sample);
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      expect(finite, track.id).toBe(true);
      expect(peak, track.id).toBeGreaterThan(0.05);
      expect(peak, track.id).toBeLessThan(1);
      expect(Math.sqrt(energy / samples.length), track.id).toBeGreaterThan(0.01);
      fingerprints.add(`${samples.length}:${samples[1000].toFixed(5)}:${samples[samples.length >> 1].toFixed(5)}`);
    }
    expect(fingerprints.size).toBe(MUSIC_TRACKS.length);
  });
});

describe('nextTrackIndex', () => {
  it('stays on the current track in loop-one mode', () => {
    expect(nextTrackIndex(2, 5, 'loop-one', Math.random)).toBe(2);
  });

  it('steps forward and back with wrap-around in sequential mode', () => {
    expect(nextTrackIndex(4, 5, 'sequential', Math.random)).toBe(0);
    expect(nextTrackIndex(0, 5, 'sequential', Math.random, -1)).toBe(4);
    expect(nextTrackIndex(1, 5, 'sequential', Math.random)).toBe(2);
  });

  it('shuffles to any other track and never repeats the current one', () => {
    const picks = new Set<number>();
    for (const value of [0, 0.2, 0.4, 0.6, 0.8, 0.999999]) {
      const pick = nextTrackIndex(2, 5, 'shuffle', () => value);
      expect(pick).not.toBe(2);
      picks.add(pick);
    }
    expect([...picks].sort()).toEqual([0, 1, 3, 4]);
    expect(nextTrackIndex(0, 1, 'shuffle', () => 0.5)).toBe(0);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundMusic } from '../../../client/src/audio/background-music';
import { createMusicSamples } from '../../../client/src/audio/music-loop';

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
  gain: { gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  source: { buffer: null; loop: boolean; connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  createGain: ReturnType<typeof vi.fn>; createBufferSource: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn<() => Promise<void>>>;
  suspend: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>;
} {
  const gain = {
    gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(),
  };
  const source = {
    buffer: null, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(),
  };
  return {
    state: 'running', currentTime: 0, destination: {}, onstatechange: null,
    gain, source,
    createGain: vi.fn(() => gain),
    createBufferSource: vi.fn(() => source),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: (): Float32Array => new Float32Array(length),
    })),
    resume: vi.fn(async (): Promise<void> => undefined),
    suspend: vi.fn(async (): Promise<void> => undefined),
    close: vi.fn(async (): Promise<void> => undefined),
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('background music', () => {
  it('allocates no audio until play and reuses one loop across pause/resume', async () => {
    const { context, construct } = mockAudio();
    const changed = vi.fn();
    const player = createBackgroundMusic(changed);
    player.setVolume(0.4);
    expect(construct).not.toHaveBeenCalled();
    await player.play();
    expect(context.gain.gain.value).toBe(0.4);
    expect(context.source.loop).toBe(true);
    expect(changed).toHaveBeenLastCalledWith(true);
    await player.pause();
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenLastCalledWith(false);
    await player.play();
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
    await player.play();
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
    const playing = player.play();
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
    await expect(player.play()).rejects.toThrow('Playback denied');
    expect(context.source.start).not.toHaveBeenCalled();
    player.dispose();
  });

  it('closes resources after source startup fails without stopping an unstarted source', async () => {
    const { context } = mockAudio();
    context.source.start.mockImplementationOnce(() => { throw new Error('Source failed'); });
    const player = createBackgroundMusic(vi.fn());
    await expect(player.play()).rejects.toThrow('Source failed');
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
    await player.play();
    const paused = player.pause();
    player.dispose();
    changed.mockClear();
    finish?.();
    await paused;
    expect(changed).not.toHaveBeenCalled();
  });

  it('produces finite audible samples below clipping with a continuous loop boundary', () => {
    const samples = createMusicSamples(22_050);
    expect(samples.length).toBe(Math.round(32 * 60 / 84 * 22_050));
    let peak = 0;
    let energy = 0;
    let finite = true;
    for (const sample of samples) {
      finite = finite && Number.isFinite(sample);
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    expect(finite).toBe(true);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThan(1);
    expect(Math.sqrt(energy / samples.length)).toBeGreaterThan(0.01);
    expect(Math.abs(samples[0] - samples[samples.length - 1])).toBeLessThan(0.01);
  });
});

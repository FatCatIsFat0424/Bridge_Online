// ─── 牌桌音效：全部即時合成，不需音檔 ───

let context: AudioContext | null = null;

function audioContext(): AudioContext {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Sine notes in sequence: [frequency Hz, start s, length s]. */
function tones(notes: readonly (readonly [number, number, number])[], volume: number): void {
  try {
    const audio = audioContext();
    for (const [frequency, start, length] of notes) {
      const at = audio.currentTime + start;
      const osc = audio.createOscillator();
      osc.frequency.value = frequency;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + length);
    }
  } catch {
    /* Audio is optional. */
  }
}

/** Rising two-note chime: it's your turn. */
export function playTurnSound(): void {
  // 稍晚於上家的出牌聲
  tones([[660, 0.15, 0.18], [988, 0.27, 0.3]], 0.25);
}

/** Falling three-note tone: a player is eliminated. */
export function playOutSound(): void {
  tones([[523, 0, 0.2], [392, 0.16, 0.2], [262, 0.32, 0.45]], 0.3);
}

/** Card snap for a play; a softer, lower knock for a pass. Silently no-ops if audio is unavailable. */
export function playCardSound(pass = false): void {
  try {
    const audio = audioContext();
    const duration = pass ? 0.12 : 0.08;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = pass ? 700 : 2400;
    filter.Q.value = 0.9;
    const gain = audio.createGain();
    gain.gain.value = pass ? 0.35 : 0.6;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
  } catch {
    /* Audio is optional. */
  }
}

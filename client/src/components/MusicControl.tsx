import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createBackgroundMusic } from '../audio/background-music';
import type { BackgroundMusic } from '../audio/background-music';
import { useI18nStore } from '../stores/i18n-store';
import styles from './MusicControl.module.css';

const VOLUME_KEY = 'bridge.music.volume';
const LABELS = {
  'zh-TW': {
    title: '背景音樂', play: '播放音樂', pause: '暫停音樂', volume: '音量',
    loading: '載入中…', error: '無法播放音樂，請重試或使用支援音訊的瀏覽器。',
  },
  en: {
    title: 'Background music', play: 'Play music', pause: 'Pause music', volume: 'Volume',
    loading: 'Loading…', error: 'Music could not start. Try again or use a browser with audio support.',
  },
} as const;

function savedVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null ? 0.25 : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.25;
  } catch {
    return 0.25;
  }
}

export function MusicControl(): ReactNode {
  const locale = useI18nStore((state) => state.locale);
  const labels = LABELS[locale];
  const player = useRef<BackgroundMusic | null>(null);
  const mounted = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [volume, setVolume] = useState(savedVolume);

  useEffect(() => {
    mounted.current = true;
    return (): void => {
      mounted.current = false;
      player.current?.dispose();
      player.current = null;
    };
  }, []);

  const toggle = async (): Promise<void> => {
    setBusy(true);
    setError(false);
    if (!player.current) {
      player.current = createBackgroundMusic((value) => {
        if (mounted.current) setPlaying(value);
      });
      player.current.setVolume(volume);
    }
    try {
      if (playing) await player.current.pause();
      else await player.current.play();
    } catch {
      player.current?.dispose();
      player.current = null;
      if (mounted.current) { setPlaying(false); setError(true); }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const changeVolume = (value: number): void => {
    setVolume(value);
    player.current?.setVolume(value);
    try { localStorage.setItem(VOLUME_KEY, String(value)); } catch { /* Storage is optional. */ }
  };

  return (
    <aside className={styles.bar} aria-label={labels.title}>
      <span className={styles.title}><span aria-hidden="true">♫ </span>{labels.title}</span>
      <button type="button" className={styles.toggle} aria-pressed={playing}
        disabled={busy} onClick={() => void toggle()}>
        {busy ? labels.loading : playing ? labels.pause : labels.play}
      </button>
      <label htmlFor="music-volume" className={styles.volume}>
        <span>{labels.volume}</span>
        <input id="music-volume" type="range" min="0" max="100" step="1"
          value={Math.round(volume * 100)} onChange={(event) => changeVolume(Number(event.target.value) / 100)} />
        <output htmlFor="music-volume">{Math.round(volume * 100)}%</output>
      </label>
      {error && <p className={styles.error} role="alert">{labels.error}</p>}
    </aside>
  );
}

import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useI18nStore } from '../stores/i18n-store';
import { useMusicStore } from '../stores/music-store';
import styles from './MusicControl.module.css';

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

export function MusicControl(): ReactNode {
  const locale = useI18nStore((state) => state.locale);
  const labels = LABELS[locale];
  const { playing, busy, error, volume, toggle, setVolume } = useMusicStore(useShallow((state) => ({
    playing: state.playing,
    busy: state.busy,
    error: state.error,
    volume: state.volume,
    toggle: state.toggle,
    setVolume: state.setVolume,
  })));

  return (
    <section className={styles.panel} aria-label={labels.title}>
      <span className={styles.title}><span aria-hidden="true">♫ </span>{labels.title}</span>
      <button type="button" className={styles.toggle} aria-pressed={playing}
        disabled={busy} onClick={() => void toggle()}>
        {busy ? labels.loading : playing ? labels.pause : labels.play}
      </button>
      <label htmlFor="music-volume" className={styles.volume}>
        <span>{labels.volume}</span>
        <input id="music-volume" type="range" min="0" max="100" step="1"
          value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)} />
        <output htmlFor="music-volume">{Math.round(volume * 100)}%</output>
      </label>
      {error && <p className={styles.error} role="alert">{labels.error}</p>}
    </section>
  );
}

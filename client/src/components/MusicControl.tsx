import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MUSIC_TRACKS } from '../audio/music-tracks';
import { MUSIC_ENERGIES, MUSIC_GENRES } from '../audio/music-categories';
import type { MusicMode } from '../audio/music-tracks';
import { useI18nStore } from '../stores/i18n-store';
import { useMusicStore } from '../stores/music-store';
import { useTurnSoundStore } from '../stores/turn-sound-store';
import styles from './MusicControl.module.css';

const LABELS = {
  'zh-TW': {
    title: '背景音樂', play: '播放音樂', pause: '暫停音樂', volume: '音量', prev: '上一首', next: '下一首',
    tracks: '曲目', loading: '載入中…', error: '無法播放音樂，請重試或使用支援音訊的瀏覽器。',
    'loop-one': '單曲循環', sequential: '依序播放', shuffle: '隨機播放',
    turnSound: '回合提醒音', turnSoundHint: '輪到自己時播放，與背景音樂分開控制。',
  },
  en: {
    title: 'Background music', play: 'Play music', pause: 'Pause music', volume: 'Volume', prev: 'Previous track',
    next: 'Next track', tracks: 'Tracks', loading: 'Loading…',
    error: 'Music could not start. Try again or use a browser with audio support.',
    'loop-one': 'Repeat one', sequential: 'Play in order', shuffle: 'Shuffle',
    turnSound: 'Your-turn sound', turnSoundHint: 'Play when it is your turn, independently of music.',
  },
} as const;

const MODE_ICONS: Record<MusicMode, string> = { 'loop-one': '🔂', sequential: '🔁', shuffle: '🔀' };
const NEXT_MODE: Record<MusicMode, MusicMode> = { 'loop-one': 'sequential', sequential: 'shuffle', shuffle: 'loop-one' };

export function MusicControl(): ReactNode {
  const turnSoundEnabled = useTurnSoundStore((state) => state.enabled);
  const setTurnSoundEnabled = useTurnSoundStore((state) => state.setEnabled);
  const locale = useI18nStore((state) => state.locale);
  const labels = LABELS[locale];
  const { playing, busy, error, volume, trackId, mode, toggle, play, next, prev, setMode, setVolume } = useMusicStore(
    useShallow((state) => ({
      playing: state.playing,
      busy: state.busy,
      error: state.error,
      volume: state.volume,
      trackId: state.trackId,
      mode: state.mode,
      toggle: state.toggle,
      play: state.play,
      next: state.next,
      prev: state.prev,
      setMode: state.setMode,
      setVolume: state.setVolume,
    })),
  );
  const current = MUSIC_TRACKS.find((track) => track.id === trackId) ?? MUSIC_TRACKS[0];
  const groups = Object.entries(MUSIC_GENRES).map(([genre, title]) => ({
    genre, title, tracks: MUSIC_TRACKS.filter((track) => track.genre === genre),
  })).filter((group) => group.tracks.length > 0);

  return (
    <section className={styles.panel} aria-label={labels.title}>
      <span className={styles.title}><span aria-hidden="true">♫ </span>{labels.title}</span>
      <p className={styles.nowPlaying} aria-live="polite">{busy ? labels.loading : current.title[locale]}</p>
      <p className={styles.attributes}>
        {MUSIC_GENRES[current.genre][locale]} · {MUSIC_ENERGIES[current.energy][locale]} · {current.bpm} BPM
      </p>
      <div className={styles.controls}>
        <button type="button" className={styles.control} aria-label={labels.prev} title={labels.prev}
          disabled={busy} onClick={() => void prev()}>⏮</button>
        <button type="button" className={styles.control} aria-pressed={playing}
          aria-label={playing ? labels.pause : labels.play} title={playing ? labels.pause : labels.play}
          disabled={busy} onClick={() => void toggle()}>⏯</button>
        <button type="button" className={styles.control} aria-label={labels.next} title={labels.next}
          disabled={busy} onClick={() => void next()}>⏭</button>
        <button type="button" className={styles.control} aria-label={labels[mode]} title={labels[mode]}
          onClick={() => setMode(NEXT_MODE[mode])}>{MODE_ICONS[mode]}</button>
      </div>
      <label htmlFor="music-volume" className={styles.volume}>
        <span>{labels.volume}</span>
        <input id="music-volume" type="range" min="0" max="100" step="1"
          value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)} />
        <output htmlFor="music-volume">{Math.round(volume * 100)}%</output>
      </label>
      <ul className={styles.tracks} aria-label={labels.tracks}>
        {groups.map((group) => (
          <li key={group.genre}>
            <h3 className={styles.genre}>{group.title[locale]}</h3>
            <ul className={styles.group}>
              {group.tracks.map((track) => (
                <li key={track.id}>
                  <button type="button" className={styles.track} aria-current={track.id === trackId}
                    disabled={busy} onClick={() => void play(track.id)}>
                    <span>{track.title[locale]}</span>
                    <span className={styles.attributes}>
                      {MUSIC_ENERGIES[track.energy][locale]} · {track.bpm} BPM
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className={styles.soundSetting}>
        <label className={styles.soundToggle}>
          <input type="checkbox" checked={turnSoundEnabled}
            onChange={(event) => setTurnSoundEnabled(event.target.checked)} />
          <span>{labels.turnSound}</span>
        </label>
        <p className={styles.attributes}>{labels.turnSoundHint}</p>
      </div>
      {error && <p className={styles.error} role="alert">{labels.error}</p>}
    </section>
  );
}

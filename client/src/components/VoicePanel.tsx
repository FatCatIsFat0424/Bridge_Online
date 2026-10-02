import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PublicAccount } from '@shared/types';
import type { TranslationKey } from '../i18n';
import { apiRequest } from '../api';
import { useAccountStore } from '../stores/account-store';
import { useRoomStore } from '../stores/room-store';
import { useI18nStore } from '../stores/i18n-store';
import {
  disposeVoice,
  joinVoice,
  leaveVoice,
  resumeVoiceAudio,
  setVoiceDeafened,
  setVoiceMuted,
  useVoiceStore,
} from '../stores/voice-store';
import type { VoiceErrorCode } from '../stores/voice-store';
import { Avatar } from './Avatar';
import styles from './VoicePanel.module.css';

const ERROR_TRANSLATIONS: Record<VoiceErrorCode, TranslationKey> = {
  unsupported: 'voice.unsupported',
  insecure: 'voice.insecure',
  permission: 'voice.permission',
  'no-microphone': 'voice.noMicrophone',
  'microphone-busy': 'voice.microphoneBusy',
  'microphone-ended': 'voice.microphoneEnded',
  configuration: 'voice.configuration',
  'join-failed': 'voice.joinFailed',
  'connection-failed': 'voice.connectionFailed',
  'signal-failed': 'voice.signalFailed',
  disconnected: 'voice.disconnected',
};

function leaveActiveVoice(): void {
  const { status } = useVoiceStore.getState();
  if (status === 'joined' || status === 'joining') leaveVoice();
}

export function VoicePanel(): ReactNode {
  const { t } = useI18nStore();
  const account = useAccountStore((state) => state.account);
  const connection = useAccountStore((state) => state.connection);
  const roomCode = useRoomStore((state) => state.currentRoomCode);
  const roomInfo = useRoomStore((state) => state.roomInfo);
  const accountId = account?.id;
  const { status, participants, muted, deafened, error, autoplayBlocked } = useVoiceStore(
    useShallow((state) => ({
      status: state.status,
      participants: state.participants,
      muted: state.muted,
      deafened: state.deafened,
      error: state.error,
      autoplayBlocked: state.autoplayBlocked,
    })),
  );
  const [profiles, setProfiles] = useState<Record<string, PublicAccount>>({});

  // Membership controls the media lifetime; navigating between pages does not.
  useEffect(() => {
    if (!accountId || !roomCode || connection !== 'ready') leaveActiveVoice();
    return leaveActiveVoice;
  }, [accountId, roomCode, connection]);

  useEffect(() => () => { disposeVoice(); }, []);

  useEffect(() => {
    const missingIds = [...new Set(participants.map((participant) => participant.accountId))]
      .filter((id) => id !== accountId && !profiles[id] &&
        !Object.values(roomInfo?.seats ?? {}).some((seat) => seat.player?.id === id));
    if (missingIds.length === 0) return;
    let active = true;
    void Promise.all(missingIds.map((id) =>
      apiRequest<{ account: PublicAccount }>(`/api/players/${encodeURIComponent(id)}`),
    )).then((results) => {
      if (!active) return;
      const found = results.flatMap((result) => result.success ? [result.account] : []);
      if (found.length === 0) return;
      setProfiles((current) => ({
        ...current,
        ...Object.fromEntries(found.map((profile) => [profile.id, profile])),
      }));
    });
    return () => { active = false; };
  }, [participants, roomInfo, accountId, profiles]);

  if (!account || !roomCode) return null;
  const joined = status === 'joined';
  const joining = status === 'joining';
  const canJoin = connection === 'ready';

  return (
    <section className={styles.panel} aria-labelledby="table-voice-title">
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 id="table-voice-title">{t('voice.title')}</h2>
          <span className={styles.roomCode}>{roomCode}</span>
          <span className={joined ? styles.connected : styles.status} role="status">
            {t(joined ? 'voice.joined' : joining ? 'common.loading' : 'voice.off')}
          </span>
        </div>
        <div className={styles.controls}>
          {joined ? <>
            <button type="button" className={`btn btn-outline ${styles.toggle}`}
              aria-pressed={muted} onClick={() => setVoiceMuted(!muted)}>
              {t('voice.mute')}
            </button>
            <button type="button" className={`btn btn-outline ${styles.toggle}`}
              aria-pressed={deafened} aria-describedby="table-voice-hint"
              onClick={() => setVoiceDeafened(!deafened)}>
              {t('voice.deafen')}
            </button>
            <button type="button" className="btn btn-outline" onClick={leaveVoice}>
              {t('voice.leave')}
            </button>
          </> : joining ? <button type="button" className="btn btn-outline" onClick={leaveVoice}>
            {t('common.cancel')}
          </button> : <button type="button" className="btn btn-primary" disabled={!canJoin}
            onClick={() => void joinVoice(roomCode, account.id)}>
            {t(error ? 'voice.retry' : 'voice.join')}
          </button>}
        </div>
      </div>
      {joining && <p className={styles.hint} role="status">{t('voice.joining')}</p>}
      {error && <p className={styles.error} role="alert">{t(ERROR_TRANSLATIONS[error])}</p>}
      {joined && <>
        <p id="table-voice-hint" className={styles.hint}>{t('voice.hint')}</p>
        <ul className={styles.participants} aria-label={t('voice.participants')}>
          {participants.map((participant) => {
            const person = participant.accountId === account.id ? account
              : Object.values(roomInfo?.seats ?? {})
                .find((seat) => seat.player?.id === participant.accountId)?.player
                ?? profiles[participant.accountId];
            return <li key={participant.peerId} className={styles.participant}>
              {person && <Avatar avatar={person.avatar} color={person.color} size="small" />}
              <span className={styles.name}>{person?.nickname ?? t('voice.player')}
                {participant.accountId === account.id && ` ${t('common.me')}`}</span>
              <span className={participant.muted ? styles.muted : styles.status}>
                {t(participant.muted ? 'voice.muted' : 'voice.microphoneOn')}</span>
              {participant.deafened && <span className={styles.muted}>{t('voice.deafened')}</span>}
            </li>;
          })}
        </ul>
        {participants.length === 1 && <p className={styles.hint}>{t('voice.empty')}</p>}
        {autoplayBlocked && !deafened && <div className={styles.playback}>
          <p role="status">{t('voice.autoplay')}</p>
          <button type="button" className="btn btn-primary"
            onClick={() => void resumeVoiceAudio()}>{t('voice.enableAudio')}</button>
        </div>}
      </>}
    </section>
  );
}

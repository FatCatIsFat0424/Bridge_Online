import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Seat } from '@shared/types';
import { socket } from '../socket';
import { usePlayerStore } from '../stores/player-store';
import { useRoomStore } from '../stores/room-store';
import { useGameStore } from '../stores/game-store';
import { useI18nStore } from '../stores/i18n-store';
import { PlayerLink } from '../components/PlayerLink';
import { ChatPanel } from '../components/ChatPanel';
import styles from './RoomPage.module.css';

const SEAT_STYLE_MAP: Record<Seat, string> = {
  N: styles.seatNorth, E: styles.seatEast, S: styles.seatSouth, W: styles.seatWest,
};

export function RoomPage(): ReactNode {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerId = usePlayerStore((state) => state.playerId);
  const roomInfo = useRoomStore((state) => state.roomInfo);
  const mySeat = useRoomStore((state) => state.mySeat);
  const phase = useGameStore((state) => state.phase);
  const { t } = useI18nStore();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attemptedRoom = useRef<string | null>(null);
  const hadRoom = useRef(false);
  const leaving = useRef(false);
  const isReady = mySeat ? roomInfo?.seats[mySeat].isReady ?? false : false;

  useEffect(() => {
    if (leaving.current) return;
    if (!roomCode) { navigate('/', { replace: true }); return; }
    if (roomInfo) {
      hadRoom.current = true;
      attemptedRoom.current = roomInfo.code;
      if (phase) navigate(`/game/${roomInfo.code}`, { replace: true });
      else if (roomInfo.code !== roomCode) navigate(`/room/${roomInfo.code}`, { replace: true });
    } else if (attemptedRoom.current !== roomCode) {
      attemptedRoom.current = roomCode;
      socket.timeout(10000).emit('room:join', { roomCode }, (timeout, result) => {
        if (timeout) setError(t('auth.connectionError'));
        else if (!result.success) setError(result.error ?? t('common.error'));
      });
    } else if (hadRoom.current) {
      navigate('/', { replace: true });
    }
  }, [roomCode, roomInfo, phase, navigate, t]);

  const handleResult = (timeout: Error | null, result?: { success: boolean; error?: string }): void => {
    setBusy(false);
    if (timeout) setError(t('auth.connectionError'));
    else if (!result?.success) setError(result?.error ?? t('common.error'));
  };
  const changeSeat = (seat: Seat): void => {
    setBusy(true);
    setError('');
    socket.timeout(10000).emit('room:changeSeat', { seat }, handleResult);
  };
  const ready = (): void => {
    if (!mySeat) return;
    setBusy(true);
    setError('');
    socket.timeout(10000).emit(isReady ? 'room:unready' : 'room:ready', handleResult);
  };
  const leave = (): void => {
    leaving.current = true;
    setBusy(true);
    socket.timeout(10000).emit('room:leave', (timeout, result) => {
      handleResult(timeout, result);
      if (!timeout && result.success) navigate('/');
      else leaving.current = false;
    });
  };

  if (!roomInfo || !roomCode) return <main className={styles.roomContainer}>
    <p role={error ? 'alert' : 'status'}>{error || t('common.loading')}</p>
    {error && <Link to="/">{t('nav.lobby')}</Link>}
  </main>;

  return (
    <main className={styles.roomContainer}>
      <div className={styles.roomHeader}>
        <div><div className={styles.roomCodeLabel}>{t('room.code')}</div>
          <div className={styles.roomCode}>{roomInfo.code}</div></div>
        <button className="btn btn-outline" onClick={leave} disabled={busy}>{t('room.leave')}</button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.seatLayout}>
        {(['N', 'E', 'S', 'W'] as Seat[]).map((seat) => {
          const seatInfo = roomInfo.seats[seat];
          const player = seatInfo.player;
          const className = [styles.seatSlot, SEAT_STYLE_MAP[seat],
            player ? styles.seatSlotOccupied : '',
            player?.id === playerId ? styles.seatSlotMine : ''].filter(Boolean).join(' ');
          if (player) return (
            <div key={seat} className={className}>
              <div className={styles.seatLabel}>{t(`seat.${seat}`)}</div>
              <PlayerLink player={player} size="medium" />
              {player.id === playerId && <span>{t('common.me')}</span>}
              <div className={seatInfo.isReady ? styles.seatReadyBadge : styles.seatNotReadyBadge}>
                {t(seatInfo.isReady ? 'room.ready.status' : 'room.seatTaken')}</div>
            </div>
          );
          return (
            <button key={seat} type="button" disabled={busy}
              className={className}
              onClick={() => changeSeat(seat)}>
              <div className={styles.seatLabel}>{t(`seat.${seat}`)}</div>
              <div className={styles.seatEmpty}>{t('room.seatEmpty')}</div>
            </button>
          );
        })}
        <div className={styles.tableCenter}><div className={styles.tableCenterText}>
          {t('room.waiting')}</div></div>
      </div>
      <div className={styles.roomFooter}>
        <button className={`btn ${isReady ? 'btn-danger' : 'btn-success'} ${styles.readyBtn}`}
          onClick={ready} disabled={busy || !mySeat}>{t(isReady ? 'room.unready' : 'room.ready')}</button>
      </div>
      <div className={styles.chat}><ChatPanel /></div>
    </main>
  );
}

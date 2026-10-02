// ─── GamePage：遊戲頁面 ───

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { socket } from '../socket';
import { useGameStore } from '../stores/game-store';
import { useRoomStore } from '../stores/room-store';
import { useI18nStore } from '../stores/i18n-store';
import { PlayerLink } from '../components/PlayerLink';
import { CardHand } from '../components/CardHand';
import { BiddingPanel } from '../components/BiddingPanel';
import { ChatPanel } from '../components/ChatPanel';
import { TrickArea } from '../components/TrickArea';
import { SUIT_SYMBOLS } from '@shared/constants';
import type { Card, Seat, BidSuit } from '@shared/types';
import styles from './GamePage.module.css';

function getSuitLabel(suit: BidSuit): ReactNode {
  if (suit === 'nt') return 'NT';
  const red = suit === 'hearts' || suit === 'diamonds';
  return <span className={red ? styles.suitRed : undefined}>{SUIT_SYMBOLS[suit]}</span>;
}

export function GamePage(): ReactNode {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const mySeat = useRoomStore((state) => state.mySeat);
  const roomInfo = useRoomStore((state) => state.roomInfo);
  const { t } = useI18nStore();
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const {
    phase,
    myHand,
    currentTurnSeat,
    validCards,
    contract,
    playing,
    result,
    redealPendingSeat,
  } = useGameStore(useShallow((state) => ({
    phase: state.phase,
    myHand: state.myHand,
    currentTurnSeat: state.currentTurnSeat,
    validCards: state.validCards,
    contract: state.contract,
    playing: state.playing,
    result: state.result,
    redealPendingSeat: state.redealPendingSeat,
  })));

  useEffect(() => {
    if (!roomInfo) navigate('/', { replace: true });
    else if (!phase) navigate(`/room/${roomInfo.code}`, { replace: true });
    else if (roomCode !== roomInfo.code) navigate(`/game/${roomInfo.code}`, { replace: true });
  }, [roomInfo, phase, roomCode, navigate]);

  const isMyTurn = mySeat === currentTurnSeat;

  const seatLabel = (seat: Seat): string => t(`seat.${seat}` as 'seat.N');

  const handleActionResult = useCallback((
    timeout: Error | null,
    response?: { success: boolean; error?: string },
  ): void => {
    setActionPending(false);
    if (timeout) setActionError(t('auth.connectionError'));
    else if (!response?.success) setActionError(response?.error ?? t('common.error'));
  }, [t]);

  const handlePlayCard = useCallback((card: Card): void => {
    setActionError('');
    setActionPending(true);
    socket.timeout(10000).emit('game:playCard', { card }, handleActionResult);
  }, [handleActionResult]);

  const handleRedealResponse = useCallback((accept: boolean): void => {
    setActionError('');
    setActionPending(true);
    socket.timeout(10000).emit('game:redealResponse', { accept }, handleActionResult);
  }, [handleActionResult]);

  const handleBackToRoom = useCallback((): void => {
    setActionError('');
    setActionPending(true);
    socket.timeout(10000).emit('game:continue', handleActionResult);
  }, [handleActionResult]);

  if (!phase) {
    return (
      <div className={styles.gameContainer}>
        <div className={styles.gameBody}>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const phaseKey = `game.${phase}` as 'game.dealing';

  return (
    <div className={styles.gameContainer}>
      {/* Header */}
      <div className={styles.gameHeader}>
        <div className={styles.gameHeaderInfo}>
          <span className={styles.phaseLabel}>{t(phaseKey)}</span>
          {contract && (
            <span className={styles.contractLabel}>
              {t('game.contract')}：{contract.level}{getSuitLabel(contract.suit)} by {seatLabel(contract.declarer)}
            </span>
          )}
        </div>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t('game.mySeat')}：{mySeat ? seatLabel(mySeat) : '—'}
        </span>
      </div>

      {/* Body */}
      <div className={styles.gameBody}>
        {actionError && phase !== 'scoring' &&
          <p className={styles.actionError} role="alert">{actionError}</p>}
        {/* 倒牌確認 */}
        {phase === 'redeal_pending' && redealPendingSeat === mySeat && (
          <div className={styles.scoreCard}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>{t('redeal.title')}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
              {t('redeal.description')}
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
              <button className="btn btn-success" disabled={actionPending}
                onClick={() => handleRedealResponse(true)}>
                {t('redeal.accept')}
              </button>
              <button className="btn btn-outline" disabled={actionPending}
                onClick={() => handleRedealResponse(false)}>
                {t('redeal.decline')}
              </button>
            </div>
          </div>
        )}

        {/* 叫牌面板 */}
        {phase === 'bidding' && (
          <div className={styles.sidePanel}>
            <BiddingPanel />
          </div>
        )}

        {/* 桌面區域 */}
        <div className={styles.tableArea}>
          {(['N', 'E', 'S', 'W'] as Seat[]).map((seat) => {
            const seatStyleMap: Record<Seat, string> = {
              N: styles.seatN,
              E: styles.seatE,
              S: styles.seatS,
              W: styles.seatW,
            };
            return (
              <div
                key={seat}
                className={`${styles.seatIndicator} ${seatStyleMap[seat]} ${currentTurnSeat === seat ? styles.seatIndicatorActive : ''}`}
              >
                <span className={styles.seatName}>{seatLabel(seat)}</span>
                {roomInfo?.seats[seat].player &&
                  <PlayerLink player={roomInfo.seats[seat].player} />}
                {seat === mySeat && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>{t('common.me')}</span>}
              </div>
            );
          })}

          <div className={styles.tableCenterArea}>
            {phase === 'playing' && playing ? (
              <TrickArea
                currentTrick={playing.currentTrick}
                trickCountEW={playing.trickCountEW}
                trickCountNS={playing.trickCountNS}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
                {phase === 'bidding' ? `${t('game.bidding')}...` : `${t('common.loading')}`}
              </div>
            )}
          </div>
        </div>

        {/* 出牌提示 */}
        {phase === 'playing' && (
          <div className={`${styles.turnIndicator} ${isMyTurn ? styles.turnIndicatorMyTurn : ''}`}>
            {isMyTurn
              ? t('game.myTurn')
              : t('game.waitingFor', { seat: currentTurnSeat ? seatLabel(currentTurnSeat) : '...' })}
          </div>
        )}

        {/* 手牌區域 */}
        <div className={styles.handArea}>
          <CardHand
            cards={myHand}
            playableCards={isMyTurn ? validCards : []}
            onCardClick={handlePlayCard}
            disabled={actionPending || !isMyTurn || phase !== 'playing'}
          />
        </div>
        <div className={styles.chatArea}><ChatPanel /></div>
      </div>

      {/* 結算彈窗 */}
      {phase === 'scoring' && result && (
        <div className={styles.scoreOverlay}>
          <div className={styles.scoreCard}>
            <h2 className={`${styles.scoreTitle} ${result.declarerTeamWins ? styles.scoreWin : styles.scoreLose}`}>
              {result.declarerTeamWins ? t('score.declarerWins') : t('score.defenderWins')}
            </h2>
            <div className={styles.scoreDetails}>
              <div>{t('game.contract')}：{result.contract.level}{getSuitLabel(result.contract.suit)} by {seatLabel(result.contract.declarer)}</div>
              <div>{t('score.required')}：{result.requiredTricks}</div>
              <div>{t('score.declarerTricks')}：{result.declarerTeamTricks}</div>
              <div>{t('score.defenderTricks')}：{result.defenderTeamTricks}</div>
            </div>
            {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
            <button className="btn btn-primary" disabled={actionPending} onClick={handleBackToRoom}>
              {t('score.backToRoom')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

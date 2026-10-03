// ─── BridgeTable：橋牌牌桌（叫牌、出牌、倒牌確認、結算） ───

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Card, Seat } from '@shared/types';
import { socket } from '../../socket';
import { useGameStore } from '../../stores/game-store';
import { useRoomStore } from '../../stores/room-store';
import { useI18nStore } from '../../stores/i18n-store';
import { BidLabel } from '../../components/AuctionTable';
import { CardHand } from '../../components/CardHand';
import { BiddingPanel } from '../../components/BiddingPanel';
import { GameInfoRail } from '../../components/GameInfoRail';
import { TrickArea } from '../../components/TrickArea';
import { GameShell } from '../GameShell';
import styles from './BridgeTable.module.css';

export function BridgeTable(): ReactNode {
  const mySeat = useRoomStore((state) => state.mySeat);
  const { t } = useI18nStore();
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const {
    phase,
    myHand,
    currentTurnSeat,
    validCards,
    playing,
    result,
    redealPendingSeat,
  } = useGameStore(useShallow((state) => ({
    phase: state.phase,
    myHand: state.myHand,
    currentTurnSeat: state.currentTurnSeat,
    validCards: state.validCards,
    playing: state.playing,
    result: state.result,
    redealPendingSeat: state.redealPendingSeat,
  })));

  const isMyTurn = mySeat === currentTurnSeat;
  const bottomSeat: Seat = mySeat ?? 'S';

  const seatLabel = (seat: Seat): string => t(`seat.${seat}`);

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

  let centre: ReactNode;
  if (phase === 'playing' && playing) {
    centre = <TrickArea currentTrick={playing.currentTrick} leadSeat={playing.trickLeadSeat}
      bottomSeat={bottomSeat} myTurn={isMyTurn} />;
  } else if (phase === 'bidding') {
    centre = <BiddingPanel />;
  } else if (phase === 'redeal_pending' && redealPendingSeat === mySeat) {
    centre = (
      <div className={styles.overlayCard}>
        <h2 className={styles.overlayTitle}>{t('redeal.title')}</h2>
        <p className={styles.overlayText}>{t('redeal.description')}</p>
        <div className={styles.overlayActions}>
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
    );
  } else if (phase === 'redeal_pending') {
    centre = <p className={styles.centreText}>{t('game.redealPending')}</p>;
  } else if (phase !== 'scoring') {
    centre = <p className={styles.centreText}>{t('common.loading')}</p>;
  }

  // 結算彈窗
  const overlay = phase === 'scoring' && result && (
    <div className={styles.scoreOverlay}>
      <div className={styles.overlayCard}>
        <h2 className={`${styles.scoreTitle} ${result.declarerTeamWins ? styles.scoreWin : styles.scoreLose}`}>
          {result.declarerTeamWins ? t('score.declarerWins') : t('score.defenderWins')}
        </h2>
        <div className={styles.scoreDetails}>
          <div>{t('game.contract')}：<BidLabel level={result.contract.level} suit={result.contract.suit} /> by {seatLabel(result.contract.declarer)}</div>
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
  );

  return (
    <GameShell
      info={<GameInfoRail />}
      centre={centre}
      hand={<CardHand
        cards={myHand}
        playableCards={isMyTurn ? validCards : []}
        onCardClick={handlePlayCard}
        disabled={actionPending || !isMyTurn || phase !== 'playing'}
      />}
      overlay={overlay}
      error={phase !== 'scoring' ? actionError : undefined}
    />
  );
}

// ─── GamePage：遊戲頁面（滿版牌桌：資訊欄 + 牌桌 + 聊天欄） ───

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { socket } from '../socket';
import { useChatStore } from '../stores/chat-store';
import { useGameStore } from '../stores/game-store';
import { useRoomStore } from '../stores/room-store';
import { useI18nStore } from '../stores/i18n-store';
import { BidLabel } from '../components/AuctionTable';
import { CardHand } from '../components/CardHand';
import { BiddingPanel } from '../components/BiddingPanel';
import { ChatPanel } from '../components/ChatPanel';
import { GameInfoRail } from '../components/GameInfoRail';
import { TableSeat } from '../components/TableSeat';
import { TrickArea } from '../components/TrickArea';
import { tablePosition } from '../game-view';
import type { Card, Seat } from '@shared/types';
import styles from './GamePage.module.css';

const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];

export function GamePage(): ReactNode {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const mySeat = useRoomStore((state) => state.mySeat);
  const roomInfo = useRoomStore((state) => state.roomInfo);
  const messageCount = useChatStore((state) => state.messages.length);
  const { t } = useI18nStore();
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [seenMessages, setSeenMessages] = useState(0);
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

  useEffect(() => {
    if (!roomInfo) navigate('/', { replace: true });
    else if (!phase) navigate(`/room/${roomInfo.code}`, { replace: true });
    else if (roomCode !== roomInfo.code) navigate(`/game/${roomInfo.code}`, { replace: true });
  }, [roomInfo, phase, roomCode, navigate]);

  const isMyTurn = mySeat === currentTurnSeat;
  const bottomSeat: Seat = mySeat ?? 'S';
  const unread = chatOpen ? 0 : Math.max(0, messageCount - seenMessages);

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

  const collapseChat = (): void => {
    setSeenMessages(messageCount);
    setChatOpen(false);
  };

  if (!phase) {
    return (
      <div className={styles.gameContainer}>
        <p className={styles.centreText}>{t('common.loading')}</p>
      </div>
    );
  }

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

  return (
    <div className={`${styles.gameContainer} ${chatOpen ? '' : styles.chatCollapsed}`}>
      <GameInfoRail />

      <main className={styles.centreColumn}>
        <div className={styles.table}>
          {SEATS.map((seat) => (
            <TableSeat key={seat} seat={seat} position={tablePosition(seat, bottomSeat)} />
          ))}
          <div className={styles.tableCentre}>{centre}</div>
          {actionError && phase !== 'scoring' &&
            <p className={styles.actionError} role="alert">{actionError}</p>}
        </div>

        <div className={styles.handZone}>
          <CardHand
            cards={myHand}
            playableCards={isMyTurn ? validCards : []}
            onCardClick={handlePlayCard}
            disabled={actionPending || !isMyTurn || phase !== 'playing'}
          />
        </div>
      </main>

      <aside className={styles.chatRail}>
        {!chatOpen && (
          <button type="button" className={styles.chatStrip} onClick={() => setChatOpen(true)}
            aria-label={t('table.chatExpand')} title={t('table.chatExpand')}>
            <span aria-hidden="true">💬</span>
            {unread > 0 && <span className={styles.unread}>{unread}</span>}
          </button>
        )}
        <div className={chatOpen ? styles.chatBody : styles.hidden}>
          <ChatPanel onCollapse={collapseChat} />
        </div>
      </aside>

      {/* 結算彈窗 */}
      {phase === 'scoring' && result && (
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
      )}
    </div>
  );
}

import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { RANK_DISPLAY, SUIT_SYMBOLS } from '@shared/constants';
import type { PresentationFrame } from '@shared/game-presentation';
import type { Card, GameType, Seat } from '@shared/types';
import { cardImageUrl } from '../cards';
import { tablePosition } from '../game-view';
import { useI18nStore } from '../stores/i18n-store';
import { useMotionStore } from '../stores/motion-store';
import { useRoomStore } from '../stores/room-store';
import styles from './GamePresentation.module.css';

const LABELS = {
  'zh-TW': {
    play: '出牌', pass: '跳過', trick: '贏得此墩', round: '取得新一輪出牌權',
    capture: '吃牌', eliminated: '出局', finish: '對局結束', winner: '獲勝',
    total: '累計點數', points: '分', reverse: '反轉方向', designate: '指定下一位',
    clockwise: '順時針', counterclockwise: '逆時針',
    reset: '點數歸零', maximum: '點數變成 99', unchanged: '點數不變',
  },
  en: {
    play: 'Played', pass: 'Pass', trick: 'Wins the trick', round: 'Leads the next round',
    capture: 'Captured', eliminated: 'Eliminated', finish: 'Game finished', winner: 'Wins',
    total: 'Total', points: 'points', reverse: 'Reverse direction', designate: 'Next player',
    clockwise: 'Clockwise', counterclockwise: 'Counterclockwise',
    reset: 'Reset to zero', maximum: 'Set total to 99', unchanged: 'Total unchanged',
  },
};

interface GamePresentationProps {
  frame: PresentationFrame;
  bottomSeat: Seat;
  gameType: GameType;
  summary?: string;
  elapsedMs?: number;
}

function specialEffect(card: Card | undefined, labels: typeof LABELS.en): string {
  if (!card) return '';
  if (card.rank === 4) return labels.reverse;
  if (card.rank === 5) return labels.designate;
  if (card.rank === 11) return labels.unchanged;
  if (card.rank === 13) return labels.maximum;
  if (card.rank === 14 && card.suit === 'spades') return labels.reset;
  return '';
}

export function GamePresentation({
  frame, bottomSeat, gameType, summary, elapsedMs = 0,
}: GamePresentationProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  const timingRef = useRef({ key: frame.key, elapsedMs });
  if (timingRef.current.key !== frame.key) timingRef.current = { key: frame.key, elapsedMs };
  const locale = useI18nStore((state) => state.locale);
  const t = useI18nStore((state) => state.t);
  const seats = useRoomStore((state) => state.roomInfo?.seats);
  const reducedMotion = useMotionStore((state) => state.reducedMotion);
  const labels = LABELS[locale];
  const name = (seat: Seat): string => seats?.[seat].player?.nickname ?? t(`seat.${seat}`);
  const position = frame.seat ? tablePosition(frame.seat, bottomSeat) : 'bottom';
  const collecting = frame.kind === 'trick' || frame.kind === 'capture';
  const effect = gameType === 'ninetynine' ? specialEffect(frame.cards[0], labels) : '';

  useLayoutEffect(() => {
    const elapsed = timingRef.current.elapsedMs;
    rootRef.current?.style.setProperty('--enter-delay', `${-elapsed}ms`);
    rootRef.current?.style.setProperty('--collect-delay', `${frame.durationMs - 300 - elapsed}ms`);
  }, [frame.key, frame.durationMs]);

  return <div ref={rootRef} key={frame.key}
    className={[styles.presentation, styles[position], reducedMotion && styles.reducedMotion,
      frame.kind === 'eliminated' && styles.eliminated].filter(Boolean).join(' ')}
    role="status" aria-live="polite" aria-atomic="true" data-presentation-kind={frame.kind}>
    <div className={styles.heading}>
      {frame.seat && <strong className={styles.playerName}>{name(frame.seat)}</strong>}
      <span>{frame.kind === 'finish' && frame.seat ? labels.winner : labels[frame.kind]}</span>
    </div>
    {frame.cards.length > 0 && <div className={collecting ? styles.collecting : undefined}>
      <div className={[styles.cards, (frame.kind === 'play' || frame.kind === 'capture') && styles.arriving,
        frame.kind === 'trick' && styles.trickCards].filter(Boolean).join(' ')}>
        {frame.cards.map((card, index) => <div className={styles.cardSlot}
          key={`${card.suit}-${card.rank}-${index}`}>
          <img className={[styles.card, frame.flipped && index === 0 && styles.flipped].filter(Boolean).join(' ')} src={cardImageUrl(card)}
            alt={`${SUIT_SYMBOLS[card.suit]}${RANK_DISPLAY[card.rank]}`} draggable={false} />
          {frame.cardSeats?.[index] && <span className={styles.cardSeat}>
            {name(frame.cardSeats[index])}
          </span>}
        </div>)}
      </div>
    </div>}
    {frame.total !== undefined && <div className={styles.total}>
      <span>{labels.total}</span>
      {frame.previousTotal !== undefined && <span>{frame.previousTotal} →</span>}
      <strong>{frame.total}</strong><span>/ 99</span>
    </div>}
    {effect && <div className={styles.effect}>{effect}
      {frame.target && <strong> · {name(frame.target)}</strong>}
    </div>}
    {gameType === 'ninetynine' && frame.direction && <div className={styles.effect}>
      {frame.direction === 'cw' ? `↻ ${labels.clockwise}` : `↺ ${labels.counterclockwise}`}
      {frame.choice && ` ${frame.choice === 'plus' ? '+' : '−'}${frame.cards[0]?.rank === 12 ? 20 : 10}`}
    </div>}
    {frame.passedSeats && frame.passedSeats.length > 0 && <div className={styles.effect}>
      {labels.pass}: {frame.passedSeats.map(name).join(' · ')}
    </div>}
    {frame.kind === 'capture' && frame.points !== undefined &&
      <div className={styles.effect}>+{frame.points} {labels.points}</div>}
    {(frame.kind === 'finish' || frame.kind === 'trick') && summary && <strong className={styles.summary}>{summary}</strong>}
  </div>;
}

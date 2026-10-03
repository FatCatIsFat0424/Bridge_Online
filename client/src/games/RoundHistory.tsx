import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RANK_DISPLAY, SUIT_SYMBOLS } from '@shared/constants';
import type { Card, PlayerVisibleGameState, Seat } from '@shared/types';
import { useI18nStore } from '../stores/i18n-store';
import { useRoomStore } from '../stores/room-store';
import { comboLabelKey } from './bigtwo/bigtwo-view';
import { deriveRoundHistory } from './round-history';
import type { HistoryRound } from './round-history';
import styles from './RoundHistory.module.css';

const LABELS = {
  'zh-TW': {
    title: '回合歷史紀錄', round: '回合', ongoing: '進行中', complete: '已完成', empty: '尚無回合紀錄',
    play: '出牌', pass: '跳過', round_end: '取得下一輪出牌權', dragon: '一條龍',
    flip: '翻牌', eliminated: '出局', captured: '吃牌', stay: '留在桌面',
    points: '分', target: '指定下一位', pending: '等待選擇吃牌',
  },
  en: {
    title: 'Round history', round: 'Round', ongoing: 'In progress', complete: 'Complete', empty: 'No rounds yet',
    play: 'Played', pass: 'Pass', round_end: 'Leads the next round', dragon: 'Dragon',
    flip: 'Flipped', eliminated: 'Eliminated', captured: 'Captured', stay: 'Left on table',
    points: 'points', target: 'Next player', pending: 'Awaiting capture choice',
  },
};

function cardLabel(card: Card): string {
  return `${SUIT_SYMBOLS[card.suit]}${RANK_DISPLAY[card.rank]}`;
}

function Round({ round }: { round: HistoryRound }): ReactNode {
  const [open, setOpen] = useState(false);
  const { locale, t } = useI18nStore();
  const seats = useRoomStore((state) => state.roomInfo?.seats);
  const labels = LABELS[locale];
  const name = (seat: Seat): string => seats?.[seat].player?.nickname ?? t(`seat.${seat}`);
  return <details className={styles.round} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{labels.round} {round.number} · {round.complete ? labels.complete : labels.ongoing}</summary>
    {open && <ol className={styles.actions}>{round.actions.map((action, index) => <li key={index}>
      <strong>{name(action.seat)}</strong> {labels[action.kind]}
      {action.cards.length > 0 && <span className={styles.cards}> {action.cards.map(cardLabel).join(' ')}</span>}
      {action.comboType && <span> · {t(comboLabelKey(action.comboType))}</span>}
      {action.captured !== undefined && <span> · {action.captured
        ? `${labels.captured} ${cardLabel(action.captured)}` : labels.stay}</span>}
      {action.points !== undefined && <span> · +{action.points} {labels.points}</span>}
      {action.total !== undefined && <span> · {action.previousTotal} → {action.total}</span>}
      {action.choice && <span> ({action.choice === 'plus' ? '+' : '−'}{action.cards[0]?.rank === 12 ? 20 : 10})</span>}
      {action.target && <span> · {labels.target}: {name(action.target)}</span>}
      {action.pending && <span> · {labels.pending}</span>}
    </li>)}</ol>}
  </details>;
}

export function RoundHistory({ game }: { game: PlayerVisibleGameState }): ReactNode {
  const [open, setOpen] = useState(false);
  const locale = useI18nStore((state) => state.locale);
  const rounds = useMemo(() => deriveRoundHistory(game), [game]);
  const labels = LABELS[locale];
  if (game.gameType === 'bridge') return null;
  return <details className={styles.history} onToggle={(event) => {
    if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
  }}>
    <summary>{labels.title} ({rounds.length})</summary>
    {open && <div className={styles.scroll}>
      {rounds.length === 0 ? <p>{labels.empty}</p>
        : rounds.map((round) => <Round key={round.number} round={round} />)}
    </div>}
  </details>;
}

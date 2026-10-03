// ─── GameShell：所有遊戲共用的牌桌外框（資訊欄 + 牌桌 + 聊天欄 + 投票終止） ───

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Seat } from '@shared/types';
import { mediaUrl } from '../media';
import { useAccountStore } from '../stores/account-store';
import { useChatStore } from '../stores/chat-store';
import { useRoomStore } from '../stores/room-store';
import { useI18nStore } from '../stores/i18n-store';
import { ChatPanel } from '../components/ChatPanel';
import { TableSeat } from '../components/TableSeat';
import { tablePosition } from '../game-view';
import { AbortVoteBanner, AbortVoteButton } from './AbortVote';
import styles from './GameShell.module.css';

const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];
const DESKTOP_QUERY = '(min-width: 1024px)';
const PHONE_QUERY = '(max-width: 767px)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

interface GameShellProps {
  /** 資訊欄內容（桌機左欄、平板浮層、手機抽屜） */
  info: ReactNode;
  /** 牌桌中央 */
  centre: ReactNode;
  /** 牌桌下方手牌區 */
  hand: ReactNode;
  /** 全畫面浮層（結算） */
  overlay?: ReactNode;
  /** 牌桌上的動作錯誤 */
  error?: string;
  /** 可點選的座位（99：指定下一位） */
  pickableSeats?: readonly Seat[];
  onPickSeat?: (seat: Seat) => void;
}

function FittedCentre({ children }: { children: ReactNode }): ReactNode {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const fit = (): void => {
      const width = Math.max(content.offsetWidth, content.scrollWidth);
      const height = Math.max(content.offsetHeight, content.scrollHeight);
      const scale = width > 0 && height > 0
        ? Math.min(1, viewport.clientWidth / width, viewport.clientHeight / height)
        : 1;
      content.style.setProperty('--centre-scale', String(scale));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    observer.observe(content);
    fit();
    return () => observer.disconnect();
  }, []);

  return <div className={styles.tableCentre} ref={viewportRef}>
    <div className={styles.centreContent} ref={contentRef}>{children}</div>
  </div>;
}

export function GameShell({
  info, centre, hand, overlay, error, pickableSeats, onPickSeat,
}: GameShellProps): ReactNode {
  const mySeat = useRoomStore((state) => state.mySeat);
  const tableBackground = useAccountStore((state) => state.account?.tableBackground);
  const messageCount = useChatStore((state) => state.messages.length);
  const { t } = useI18nStore();
  // 平板預設收合聊天；手機為底部抽屜，預設關閉
  const [chatOpen, setChatOpen] = useState(() => matches(DESKTOP_QUERY));
  const [infoOpen, setInfoOpen] = useState(false);
  const [seenMessages, setSeenMessages] = useState(0);
  const bottomSeat: Seat = mySeat ?? 'S';
  const unread = chatOpen ? 0 : Math.max(0, messageCount - seenMessages);

  const collapseChat = useCallback((): void => {
    setSeenMessages(messageCount);
    setChatOpen(false);
  }, [messageCount]);

  // 縮到桌機寬度以下時收起聊天，避免手機版一進來就被聊天抽屜蓋住
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent): void => { if (!event.matches) collapseChat(); };
    query.addEventListener('change', onChange);
    return (): void => query.removeEventListener('change', onChange);
  }, [collapseChat]);

  // 手機一次只開一個抽屜
  const openInfo = (): void => {
    if (matches(PHONE_QUERY) && chatOpen) collapseChat();
    setInfoOpen((open) => !open);
  };

  const openChat = (): void => {
    setInfoOpen(false);
    setChatOpen(true);
  };

  const closeSheets = useCallback((): void => {
    setInfoOpen(false);
    if (matches(PHONE_QUERY)) collapseChat();
  }, [collapseChat]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeSheets();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSheets]);

  return (
    <div className={`${styles.gameContainer} ${chatOpen ? '' : styles.chatCollapsed} ${infoOpen ? styles.infoOpen : ''}`}>
      {(infoOpen || chatOpen) && <button type="button" className={styles.backdrop} tabIndex={-1}
        aria-label={t('table.close')} onClick={closeSheets} />}

      <div className={styles.infoPanel} id="game-info-panel">
        <div className={styles.sheetHeader}>
          <span>{t('table.info')}</span>
          <button type="button" className={styles.sheetClose} onClick={() => setInfoOpen(false)}
            aria-label={t('table.close')} title={t('table.close')}>✕</button>
        </div>
        <AbortVoteButton />
        {info}
      </div>

      <main className={`${styles.centreColumn} ${tableBackground ? styles.customTable : ''}`}
        style={tableBackground
          ? { '--table-image': `url("${mediaUrl(tableBackground)}")` } as CSSProperties : undefined}>
        <div className={styles.table}>
          <div className={styles.tableTools}>
            <button type="button" className={styles.toolBtn} onClick={openInfo}
              aria-label={t('table.info')} title={t('table.info')}
              aria-expanded={infoOpen} aria-controls="game-info-panel">
              <span aria-hidden="true">📋</span>
            </button>
            <button type="button" className={`${styles.toolBtn} ${styles.chatFab}`} onClick={openChat}
              aria-label={t('table.chatExpand')} title={t('table.chatExpand')} aria-expanded={chatOpen}>
              <span aria-hidden="true">💬</span>
              {unread > 0 && <span className={`${styles.unread} ${styles.fabBadge}`}>{unread}</span>}
            </button>
          </div>
          {SEATS.map((seat) => (
            <TableSeat key={seat} seat={seat} position={tablePosition(seat, bottomSeat)}
              onPick={onPickSeat && pickableSeats?.includes(seat) ? () => onPickSeat(seat) : undefined} />
          ))}
          <FittedCentre>{centre}</FittedCentre>
          <AbortVoteBanner />
          {error && <p className={styles.actionError} role="alert">{error}</p>}
        </div>

        <div className={styles.handZone}>{hand}</div>
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

      {overlay}
    </div>
  );
}

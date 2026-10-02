import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ChatMessage } from '@shared/types';
import { splitEmojiText } from '@shared/constants';
import { socket } from '../socket';
import { mediaUrl } from '../media';
import { useChatStore } from '../stores/chat-store';
import { useEmojiStore } from '../stores/emoji-store';
import { useI18nStore } from '../stores/i18n-store';
import { Avatar } from './Avatar';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  /** 提供時：面板填滿容器高度，標題列顯示收合按鈕 */
  onCollapse?: () => void;
}

/** Text stays text; only emoji the server attached to this message become images. */
function messageContent(message: ChatMessage): ReactNode[] {
  return splitEmojiText(message.content, message.emojis).map((segment, index) =>
    typeof segment === 'string' ? segment : (
      <img key={index} className={styles.emoji} src={mediaUrl(segment.mediaId)}
        alt={`:${segment.name}:`} title={`:${segment.name}:`} />
    ));
}

export function ChatPanel({ onCollapse }: ChatPanelProps): ReactNode {
  const messages = useChatStore((state) => state.messages);
  const emojis = useEmojiStore((state) => state.emojis);
  const loadEmojis = useEmojiStore((state) => state.load);
  const { t } = useI18nStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const container = messagesRef.current;
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => { void loadEmojis(); }, [loadEmojis]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-emoji-picker]')) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  const insertEmoji = (name: string): void => {
    const field = inputRef.current;
    const start = field?.selectionStart ?? input.length;
    const end = field?.selectionEnd ?? input.length;
    const token = `:${name}:`;
    setInput(input.slice(0, start) + token + input.slice(end));
    setPickerOpen(false);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const send = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError('');
    socket.timeout(10000).emit('chat:send', { message }, (timeout, result) => {
      setBusy(false);
      if (timeout) setError(t('auth.connectionError'));
      else if (result.success) setInput('');
      else setError(result.error ?? t('common.error'));
    });
  };

  const query = search.trim().toLowerCase();
  const matches = emojis.filter((emoji) => emoji.name.includes(query));

  return (
    <section className={`${styles.chatContainer} ${onCollapse ? styles.fill : ''}`}>
      <div className={styles.chatHeader}>
        <h2 className={styles.chatTitle}>{t('chat.title')}</h2>
        {onCollapse && <button type="button" className={styles.collapseBtn} onClick={onCollapse}
          aria-label={t('table.chatCollapse')} title={t('table.chatCollapse')}>›</button>}
      </div>
      <div ref={messagesRef} className={styles.chatMessages} role="log" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={styles.chatMessage}>
            <Avatar avatar={message.sender.avatar} image={message.sender.avatarImage} color={message.sender.color} size="small" />
            <span className={styles.chatSender}>{message.sender.nickname}</span>
            <span className={styles.chatContent}>{messageContent(message)}</span>
          </div>
        ))}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {pickerOpen && (
        <div className={styles.picker} data-emoji-picker>
          <input className={styles.pickerSearch} type="search" value={search} autoFocus
            aria-label={t('emoji.search')} placeholder={t('emoji.search')}
            onChange={(event) => setSearch(event.target.value)} />
          {matches.length === 0 ? (
            <p className={styles.pickerEmpty}>
              {emojis.length === 0 ? t('emoji.empty') : t('emoji.noMatch')}{' '}
              <Link to="/account">{t('emoji.manage')}</Link>
            </p>
          ) : (
            <div className={styles.pickerGrid}>
              {matches.map((emoji) => (
                <button key={emoji.id} type="button" className={styles.pickerItem}
                  title={`:${emoji.name}:`} onClick={() => insertEmoji(emoji.name)}>
                  <img src={mediaUrl(emoji.mediaId)} alt={`:${emoji.name}:`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <form className={styles.chatInputRow} onSubmit={send}>
        <button type="button" className={styles.pickerBtn} data-emoji-picker
          aria-label={t('emoji.picker')} title={t('emoji.picker')} aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}>☺</button>
        <input ref={inputRef} className={styles.chatInput} type="text" aria-label={t('chat.placeholder')}
          placeholder={t('chat.placeholder')} value={input} maxLength={500}
          onChange={(event) => setInput(event.target.value)} />
        <button type="submit" className={styles.chatSendBtn} disabled={busy || !input.trim()}>
          {t('chat.send')}</button>
      </form>
    </section>
  );
}

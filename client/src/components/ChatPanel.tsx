import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ChatMessage, EmojiRecord } from '@shared/types';
import { splitEmojiText } from '@shared/constants';
import { socket } from '../socket';
import { mediaUrl } from '../media';
import { useChatStore } from '../stores/chat-store';
import { useEmojiStore } from '../stores/emoji-store';
import { useI18nStore } from '../stores/i18n-store';
import type { TranslationKey } from '../i18n';
import { Avatar } from './Avatar';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  /** 提供時：面板填滿容器高度，標題列顯示收合按鈕 */
  onCollapse?: () => void;
}

function StickerImage({ asset, small = false }: {
  asset: Pick<EmojiRecord, 'name' | 'mediaId'>; small?: boolean;
}): ReactNode {
  const [failed, setFailed] = useState(false);
  const { t } = useI18nStore();
  return <span className={`${styles.stickerImage} ${small ? styles.smallImage : ''}`}>
    {failed ? <span role="img" aria-label={asset.name}>{t('sticker.unavailable')}: {asset.name}</span>
      : <img src={mediaUrl(asset.mediaId)} alt={asset.name} onError={() => setFailed(true)} />}
  </span>;
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
  const [mode, setMode] = useState<'emoji' | 'sticker'>('emoji');
  const busyRef = useRef(false);
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
    if (!message || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    socket.timeout(10000).emit('chat:send', { message }, (timeout, result) => {
      busyRef.current = false;
      setBusy(false);
      if (timeout) setError(t('auth.connectionError'));
      else if (result.success) setInput('');
      else setError(result.error ?? t('common.error'));
    });
  };

  const sendSticker = (stickerId: string): void => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    socket.timeout(10000).emit('chat:send', { stickerId }, (timeout, result) => {
      busyRef.current = false;
      setBusy(false);
      if (timeout) setError(t('auth.connectionError'));
      else if (!result.success) setError(result.error ?? t('common.error'));
      else setPickerOpen(false);
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
        {messages.map((message) => message.system ? (
          <p key={message.id} className={styles.systemMessage}>
            {t(message.content as TranslationKey, { name: message.sender.nickname })}
          </p>
        ) : (
          <div key={message.id} className={styles.chatMessage}>
            <Avatar avatar={message.sender.avatar} image={message.sender.avatarImage} color={message.sender.color} size="small" />
            <span className={styles.chatSender}>{message.sender.nickname}</span>
            <span className={styles.chatContent}>{message.sticker ? <StickerImage asset={message.sticker} /> : messageContent(message)}</span>
          </div>
        ))}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {pickerOpen && (
        <div className={`${styles.picker} ${mode === 'sticker' ? styles.stickerPicker : ''}`} data-emoji-picker>
          <div className={styles.pickerTabs}>
            <button type="button" aria-pressed={mode === 'emoji'} onClick={() => setMode('emoji')}>{t('emoji.title')}</button>
            <button type="button" aria-pressed={mode === 'sticker'} onClick={() => setMode('sticker')}>{t('sticker.mode')}</button>
          </div>
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
                  title={`:${emoji.name}:`} disabled={mode === 'sticker' && busy}
                  onClick={() => mode === 'emoji' ? insertEmoji(emoji.name) : sendSticker(emoji.id)}>
                  <StickerImage asset={emoji} small />
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

import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { socket } from '../socket';
import { useChatStore } from '../stores/chat-store';
import { useI18nStore } from '../stores/i18n-store';
import { Avatar } from './Avatar';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  /** 提供時：面板填滿容器高度，標題列顯示收合按鈕 */
  onCollapse?: () => void;
}

export function ChatPanel({ onCollapse }: ChatPanelProps): ReactNode {
  const messages = useChatStore((state) => state.messages);
  const { t } = useI18nStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesRef.current;
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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
            <Avatar avatar={message.sender.avatar} color={message.sender.color} size="small" />
            <span className={styles.chatSender}>{message.sender.nickname}</span>
            <span className={styles.chatContent}>{message.content}</span>
          </div>
        ))}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <form className={styles.chatInputRow} onSubmit={send}>
        <input className={styles.chatInput} type="text" aria-label={t('chat.placeholder')}
          placeholder={t('chat.placeholder')} value={input} maxLength={500}
          onChange={(event) => setInput(event.target.value)} />
        <button type="submit" className={styles.chatSendBtn} disabled={busy || !input.trim()}>
          {t('chat.send')}</button>
      </form>
    </section>
  );
}

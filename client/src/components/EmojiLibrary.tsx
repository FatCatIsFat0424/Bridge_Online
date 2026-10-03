import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { EmojiRecord, MediaId } from '@shared/types';
import { MAX_EMOJIS_PER_ACCOUNT } from '@shared/constants';
import { apiRequest } from '../api';
import { emojiNameFromFile } from '../emoji-names';
import { resizeImage } from '../image-resize';
import { mediaUrl, uploadImage } from '../media';
import { useEmojiStore } from '../stores/emoji-store';
import { useI18nStore } from '../stores/i18n-store';
import styles from './EmojiLibrary.module.css';

const ACCEPT = 'image/png,image/gif,image/webp,image/jpeg';
const MAX_GIF_BYTES = 256 * 1024;
const BATCH = 50;

type Editing = { id: string; mode: 'rename'; name: string } | { id: string; mode: 'delete' };

export function EmojiLibrary(): ReactNode {
  const { t } = useI18nStore();
  const emojis = useEmojiStore((state) => state.emojis);
  const load = useEmojiStore((state) => state.load);
  const setEmojis = useEmojiStore((state) => state.setEmojis);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
    // `webkitdirectory` is not in React's attribute types.
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, [load]);

  const importFiles = async (files: File[]): Promise<void> => {
    const images = files.filter((file) => ACCEPT.split(',').includes(file.type));
    if (images.length === 0) return;
    setBusy(true);
    setError('');
    setReport([]);
    const room = MAX_EMOJIS_PER_ACCOUNT - useEmojiStore.getState().emojis.length;
    const skipped = images.slice(Math.max(room, 0)).map((file) => `${file.name} (${t('emoji.full')})`);
    const taken = new Set(useEmojiStore.getState().emojis.map((emoji) => emoji.name));
    const items: { name: string; mediaId: MediaId }[] = [];
    const accepted = images.slice(0, Math.max(room, 0));
    for (const [index, file] of accepted.entries()) {
      setProgress(t('emoji.progress', { done: String(index + 1), total: String(accepted.length) }));
      try {
        if (file.type === 'image/gif' && file.size > MAX_GIF_BYTES) throw new Error(t('emoji.tooLarge'));
        const blob = file.type === 'image/gif' ? file
          : await resizeImage(file, { size: 128, square: false, quality: 0.9, fallbackType: 'image/png' });
        items.push({ name: emojiNameFromFile(file.name, taken), mediaId: await uploadImage(blob, 'emoji') });
      } catch (reason) {
        skipped.push(`${file.name} (${reason instanceof Error ? reason.message : t('common.error')})`);
      }
    }
    let created = 0;
    for (let start = 0; start < items.length; start += BATCH) {
      const result = await apiRequest<{ emojis: EmojiRecord[] }>('/api/emojis', 'POST', {
        items: items.slice(start, start + BATCH),
      });
      if (!result.success) {
        setError(result.error);
        break;
      }
      created += result.emojis.length;
      setEmojis([...useEmojiStore.getState().emojis, ...result.emojis]);
    }
    setProgress(t('emoji.imported', { count: String(created) }));
    setReport(skipped);
    setBusy(false);
  };

  const choose = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void importFiles(files);
  };

  const rename = async (event: FormEvent<HTMLFormElement>, id: string, name: string): Promise<void> => {
    event.preventDefault();
    setError('');
    const result = await apiRequest<{ emoji: EmojiRecord }>(`/api/emojis/${encodeURIComponent(id)}`,
      'PATCH', { name: name.trim() });
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEmojis(useEmojiStore.getState().emojis.map((emoji) => emoji.id === id ? result.emoji : emoji));
    setEditing(null);
  };

  const remove = async (id: string): Promise<void> => {
    setError('');
    const result = await apiRequest(`/api/emojis/${encodeURIComponent(id)}`, 'DELETE');
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEmojis(useEmojiStore.getState().emojis.filter((emoji) => emoji.id !== id));
    setEditing(null);
  };

  return (
    <>
      <p className={styles.hint}>{t('emoji.help')} ({emojis.length}/{MAX_EMOJIS_PER_ACCOUNT})</p>
      <div className={styles.actions}>
        <input ref={filesInput} type="file" multiple accept={ACCEPT} hidden onChange={choose} />
        <input ref={folderInput} type="file" multiple hidden onChange={choose} />
        <button type="button" className="btn btn-outline" disabled={busy}
          onClick={() => filesInput.current?.click()}>{t('emoji.import')}</button>
        <button type="button" className="btn btn-outline" disabled={busy}
          onClick={() => folderInput.current?.click()}>{t('emoji.importFolder')}</button>
      </div>
      {progress && <p role="status" className={styles.hint}>{progress}</p>}
      {report.length > 0 && <p className={styles.error}>{t('emoji.skipped', { names: report.join('、') })}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {emojis.length === 0 ? <p className={styles.hint}>{t('emoji.empty')}</p> : (
        <ul className={styles.grid}>
          {emojis.map((emoji) => (
            <li key={emoji.id} className={styles.item}>
              <img className={styles.image} src={mediaUrl(emoji.mediaId)} alt={`:${emoji.name}:`} />
              {editing?.id === emoji.id && editing.mode === 'rename' ? (
                <form className={styles.renameForm}
                  onSubmit={(event) => void rename(event, emoji.id, editing.name)}>
                  <input value={editing.name} aria-label={t('emoji.renamePrompt')} autoFocus
                    pattern="[a-z0-9_]{2,32}" maxLength={32} required
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                  <button type="submit" className="btn btn-primary">{t('common.save')}</button>
                  <button type="button" className="btn btn-outline"
                    onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                </form>
              ) : editing?.id === emoji.id ? (
                <div className={styles.renameForm}>
                  <span>{t('emoji.confirmDelete', { name: emoji.name })}</span>
                  <button type="button" className="btn btn-danger"
                    onClick={() => void remove(emoji.id)}>{t('emoji.delete')}</button>
                  <button type="button" className="btn btn-outline"
                    onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                </div>
              ) : (
                <>
                  <code className={styles.name}>:{emoji.name}:</code>
                  <div className={styles.itemActions}>
                    <button type="button" className={styles.link}
                      onClick={() => setEditing({ id: emoji.id, mode: 'rename', name: emoji.name })}>
                      {t('emoji.rename')}</button>
                    <button type="button" className={styles.link}
                      onClick={() => setEditing({ id: emoji.id, mode: 'delete' })}>
                      {t('emoji.delete')}</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

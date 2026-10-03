import type { MediaId } from '../types/account';

/** Content-addressed upload: sha256 hex digest plus image extension. */
export function isMediaId(value: unknown): value is MediaId {
  return typeof value === 'string' && /^[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(value);
}

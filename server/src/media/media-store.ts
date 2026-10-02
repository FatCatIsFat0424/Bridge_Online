import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { MediaId } from '@shared/types';
import { isMediaId } from '@shared/constants';

export type ImageKind = 'png' | 'jpg' | 'gif' | 'webp';

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** Magic bytes only; the extension and Content-Type come from this, never from the client. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return 'webp';
  return null;
}

export interface MediaStore {
  /** Rejects bytes that are not a supported image. */
  save(bytes: Uint8Array): Promise<MediaId>;
  /** Absolute file path, or null when the id is malformed or not stored. */
  path(id: MediaId): string | null;
}

/** Content-addressed: identical uploads share one file, so saves are idempotent. */
export function createMediaStore(directory: string): MediaStore {
  const root = resolve(directory);
  return {
    save: async (bytes) => {
      const kind = sniffImage(bytes);
      if (!kind) throw new Error('Unsupported image format.');
      const id = `${createHash('sha256').update(bytes).digest('hex')}.${kind}`;
      const target = join(root, id);
      if (existsSync(target)) return id;
      await mkdir(root, { recursive: true });
      const temporaryPath = `${target}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temporaryPath, 'wx', 0o600);
        try {
          await handle.writeFile(bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporaryPath, target);
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
      return id;
    },
    // ponytail: sync existence check per lookup; fine for profile edits and cached GETs.
    path: (id) => {
      if (!isMediaId(id)) return null;
      const target = join(root, id);
      return existsSync(target) ? target : null;
    },
  };
}

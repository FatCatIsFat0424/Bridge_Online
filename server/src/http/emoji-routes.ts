import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { MediaId } from '@shared/types';
import { isEmojiName, isMediaId } from '@shared/constants';
import type { AuthService } from '../auth/auth-service';
import { getRequestSession, requireSession } from '../auth/http-middleware';
import type { Repository } from '../database/repository';

const MAX_BATCH = 50;
const CONFLICTS: Record<string, number> = { EMOJI_EXISTS: 409, EMOJI_LIMIT: 409 };

function handleAsync(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response).catch((error: unknown) => {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code) : '';
      if (CONFLICTS[code] && error instanceof Error) {
        response.status(CONFLICTS[code]).json({ success: false, error: error.message });
      } else next(error);
    });
  };
}

function field(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null && key in body
    ? (body as Record<string, unknown>)[key] : undefined;
}

function parseItems(
  value: unknown,
  mediaExists: (id: MediaId) => boolean,
): { name: string; mediaId: MediaId }[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH) return null;
  const items = value.map((item: unknown) => ({
    name: field(item, 'name'), mediaId: field(item, 'mediaId'),
  }));
  const valid = items.every((item) => isEmojiName(item.name) && isMediaId(item.mediaId) &&
    mediaExists(item.mediaId));
  return valid && new Set(items.map((item) => item.name)).size === items.length
    ? items as { name: string; mediaId: MediaId }[] : null;
}

export function createEmojiRouter(
  repository: Repository,
  authService: AuthService,
  mediaExists: (id: MediaId) => boolean,
): Router {
  const router = Router();
  router.use(requireSession(authService));

  router.get('/', handleAsync(async (_request, response): Promise<void> => {
    const { account } = getRequestSession(response);
    response.json({ success: true, emojis: await repository.listEmojis(account.id) });
  }));

  router.post('/', handleAsync(async (request, response): Promise<void> => {
    const items = parseItems(field(request.body, 'items'), mediaExists);
    if (!items) {
      response.status(400).json({ success: false, error:
        `Send 1–${MAX_BATCH} emoji with unique names (2–32 of a–z, 0–9, _) and uploaded images.` });
      return;
    }
    const { account } = getRequestSession(response);
    const emojis = await repository.createEmojis(account.id, items, Date.now());
    response.status(201).json({ success: true, emojis });
  }));

  router.patch('/:id', handleAsync(async (request, response): Promise<void> => {
    const name = field(request.body, 'name');
    if (!isEmojiName(name)) {
      response.status(400).json({ success: false, error:
        'Emoji names use 2–32 lowercase letters, numbers, or underscores.' });
      return;
    }
    const { account } = getRequestSession(response);
    const emoji = await repository.renameEmoji(account.id, request.params.id, name);
    if (!emoji) {
      response.status(404).json({ success: false, error: 'Emoji not found.' });
      return;
    }
    response.json({ success: true, emoji });
  }));

  router.delete('/:id', handleAsync(async (request, response): Promise<void> => {
    const { account } = getRequestSession(response);
    if (!await repository.deleteEmoji(account.id, request.params.id)) {
      response.status(404).json({ success: false, error: 'Emoji not found.' });
      return;
    }
    response.json({ success: true });
  }));

  return router;
}

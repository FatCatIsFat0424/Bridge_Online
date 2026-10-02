import { Router } from 'express';
import type { AuthService } from '../auth/auth-service';
import { requireSession } from '../auth/http-middleware';
import type { Repository } from '../database/repository';
import { publicProfile } from '../social/friend-service';

/** Profiles expose the same account fields already visible in the friends list. */
export function createPlayerRouter(repository: Repository, authService: AuthService): Router {
  const router = Router();
  router.use(requireSession(authService));

  router.get('/:accountId', (request, response, next) => {
    const { accountId } = request.params;
    if (typeof accountId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(accountId)) {
      response.status(400).json({ success: false, error: 'Invalid player ID.' });
      return;
    }
    void repository
      .getAccountById(accountId)
      .then((account) => {
        if (!account) {
          response.status(404).json({ success: false, error: 'Player not found.' });
          return;
        }
        response.json({ success: true, account: publicProfile(account) });
      })
      .catch(next);
  });

  return router;
}

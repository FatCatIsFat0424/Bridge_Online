import { Router } from 'express';
import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type { AccountProfile } from '@shared/types';
import type { AuthService, AuthResult } from '../auth/auth-service';
import { SESSION_COOKIE_NAME } from '../auth/auth-service';
import {
  createRateLimiter,
  getRequestSession,
  protectMutations,
  requireSession,
} from '../auth/http-middleware';

export interface AuthRouterConfig {
  readonly allowedOrigins: readonly string[];
  readonly secureCookies?: boolean;
  readonly onAccountUpdated?: (account: AccountProfile) => void | Promise<void>;
  readonly onSessionsRevoked?: (accountId: string, tokenHash?: string) => void | Promise<void>;
}

export function createAuthRouter(service: AuthService, config: AuthRouterConfig): Router {
  const router = Router();
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies ?? false,
    path: '/',
  };
  const auth = requireSession(service);
  const sensitiveLimit = createRateLimiter(20, 15 * 60 * 1000, 'auth');
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(protectMutations(config.allowedOrigins));
  router.use(createRateLimiter(300, 60 * 1000, 'account'));

  function route(action: (request: Request, response: Response) => Promise<void>): RequestHandler {
    return (request, response, next) => {
      void action(request, response).catch(next);
    };
  }

  function signedIn(response: Response, result: AuthResult, status = 200): void {
    response.cookie(SESSION_COOKIE_NAME, result.token, {
      ...cookieOptions,
      expires: new Date(result.session.expiresAt),
    });
    response.status(status).json({ success: true, account: result.account });
  }

  router.post(
    '/register',
    sensitiveLimit,
    route(async (request, response) => {
      signedIn(response, await service.register(request.body), 201);
    }),
  );
  router.post(
    '/login',
    sensitiveLimit,
    route(async (request, response) => {
      signedIn(response, await service.login(request.body));
    }),
  );
  router.get(
    '/me',
    auth,
    route(async (_request, response) => {
      response.json({ success: true, account: getRequestSession(response).account });
    }),
  );
  router.post(
    '/logout',
    route(async (request, response) => {
      const session = await service.resolveSession(request.headers.cookie);
      if (session) {
        await service.logout(session.session);
        await config.onSessionsRevoked?.(session.account.id, session.session.tokenHash);
      }
      response.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
      response.json({ success: true });
    }),
  );
  router.post(
    '/logout-all',
    auth,
    route(async (_request, response) => {
      const { account } = getRequestSession(response);
      await service.logoutAll(account.id);
      await config.onSessionsRevoked?.(account.id);
      response.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
      response.json({ success: true });
    }),
  );
  router.patch(
    '/profile',
    auth,
    route(async (request, response) => {
      const account = await service.updateProfile(
        getRequestSession(response).account.id,
        request.body,
      );
      await config.onAccountUpdated?.(account);
      response.json({ success: true, account });
    }),
  );
  router.post(
    '/password',
    sensitiveLimit,
    auth,
    route(async (request, response) => {
      const { account } = getRequestSession(response);
      await service.changePassword(account.id, request.body);
      await config.onSessionsRevoked?.(account.id);
      response.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
      response.json({ success: true });
    }),
  );
  router.use(
    (error: unknown, _request: Request, response: Response, _next: (error?: unknown) => void) => {
      if (
        error instanceof Error &&
        'status' in error &&
        typeof error.status === 'number' &&
        error.status >= 400 &&
        error.status < 500
      ) {
        response.status(error.status).json({ success: false, error: error.message });
        return;
      }
      console.error('[auth] Request failed:', error);
      response
        .status(500)
        .json({ success: false, error: 'Unable to complete the request. Please try again.' });
    },
  );
  return router;
}

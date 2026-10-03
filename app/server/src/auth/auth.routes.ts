import { Router } from 'express';
import type { Request } from 'express';
import type Database from 'better-sqlite3';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ApiError } from '../errors/api-error.js';
import {
  requireAuthentication,
  requireRoles,
  requireTrustedOrigin,
} from './auth.middleware.js';
import {
  authenticate,
  changePassword,
  createInitialSystemManager,
  createUser,
  hasUsers,
  getUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from './auth.service.js';
import { clearSessionCookieOptions, SESSION_COOKIE, sessionCookieOptions } from './session.js';
import { ROLES } from './auth.types.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});
const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  fullname: z.string().trim().min(1).max(140),
  password: z.string().min(12).max(256),
  role: z.enum(ROLES),
});
const bootstrapSchema = createUserSchema.omit({ role: true });
const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});
const userIdSchema = z.coerce.number().int().positive();

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request details are invalid.',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

function parseUserId(value: string): number {
  const parsed = userIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_USER_ID', 'User ID must be a positive integer.');
  }
  return parsed.data;
}

export function createAuthRouter(database: Database.Database): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'LOGIN_RATE_LIMITED',
        message: 'Too many sign-in attempts. Try again later.',
      },
    },
  });

  const bootstrapLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'BOOTSTRAP_RATE_LIMITED',
        message: 'Too many setup attempts. Try again later.',
      },
    },
  });

  router.get('/bootstrap-status', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ required: !hasUsers(database) });
  });

  router.post(
    '/bootstrap',
    requireTrustedOrigin,
    bootstrapLimiter,
    async (request, response) => {
      const input = parseBody(bootstrapSchema, request.body);
      await createInitialSystemManager(database, {
        email: input.email,
        fullname: input.fullname,
        password: input.password,
      });
      const { user, token } = await authenticate(
        database,
        input.email,
        input.password,
      );
      response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
      response.status(201).json({ user });
    },
  );

  router.post('/login', requireTrustedOrigin, loginLimiter, async (request, response) => {
    const { email, password } = parseBody(loginSchema, request.body);
    const { user, token } = await authenticate(database, email, password);
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    response.json({ user });
  });

  router.post(
    '/logout',
    requireTrustedOrigin,
    requireAuthentication(database),
    (request, response) => {
      if (request.sessionTokenHash) {
        database
          .prepare('DELETE FROM sessions WHERE token_hash = ?')
          .run(request.sessionTokenHash);
      }
      response.clearCookie(SESSION_COOKIE, clearSessionCookieOptions());
      response.status(204).end();
    },
  );

  router.get('/session', requireAuthentication(database), (request, response) => {
    response.json({ user: request.user });
  });

  router.post(
    '/password',
    requireTrustedOrigin,
    requireAuthentication(database),
    async (request, response) => {
      const input = parseBody(changePasswordSchema, request.body);
      await changePassword(
        database,
        request.user!.id,
        input.currentPassword,
        input.newPassword,
      );
      response.clearCookie(SESSION_COOKIE, clearSessionCookieOptions());
      response.status(204).end();
    },
  );

  router.get(
    '/users',
    requireAuthentication(database),
    requireRoles('System Manager'),
    (_request, response) => {
      response.json({ users: listUsers(database) });
    },
  );

  router.post(
    '/users',
    requireTrustedOrigin,
    requireAuthentication(database),
    requireRoles('System Manager'),
    async (request, response) => {
      const input = parseBody(createUserSchema, request.body);
      const user = await createUser(database, input, request.user!.id);
      response.status(201).json({ user });
    },
  );

  router.patch(
    '/users/:userId',
    requireTrustedOrigin,
    requireAuthentication(database),
    requireRoles('System Manager'),
    (request: Request<{ userId: string }>, response) => {
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'User changes are invalid.');
      }
      const userId = parseUserId(request.params.userId);
      if (request.user?.id === userId && parsed.data.isActive === false) {
        throw new ApiError(400, 'CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own user.');
      }
      response.json({
        user: updateUser(database, userId, parsed.data, request.user!.id),
      });
    },
  );

  router.put(
    '/users/:userId/password',
    requireTrustedOrigin,
    requireAuthentication(database),
    requireRoles('System Manager'),
    async (request: Request<{ userId: string }>, response) => {
      const input = parseBody(
        z.object({ password: z.string().min(12).max(256) }),
        request.body,
      );
      await resetUserPassword(
        database,
        parseUserId(request.params.userId),
        input.password,
        request.user!.id,
      );
      response.status(204).end();
    },
  );

  router.get(
    '/users/:userId',
    requireAuthentication(database),
    requireRoles('System Manager'),
    (request: Request<{ userId: string }>, response) => {
      response.json({ user: getUser(database, parseUserId(request.params.userId)) });
    },
  );

  return router;
}

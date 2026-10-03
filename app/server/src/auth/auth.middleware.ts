import type { RequestHandler } from 'express';
import type Database from 'better-sqlite3';
import { ApiError } from '../errors/api-error.js';
import { config } from '../config/env.js';
import { hashSessionToken, SESSION_COOKIE } from './session.js';
import type { AuthenticatedUser, Role } from './auth.types.js';

function readCookie(request: Parameters<RequestHandler>[0], name: string): string | null {
  const header = request.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function requireAuthentication(database: Database.Database): RequestHandler {
  return (request, _response, next) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) {
      next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'));
      return;
    }

    const tokenHash = hashSessionToken(token);
    const row = database
      .prepare(
        `SELECT u.id, u.email, u.fullname, u.role, s.token_hash
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`,
      )
      .get(tokenHash, new Date().toISOString()) as
      | (AuthenticatedUser & { token_hash: string })
      | undefined;

    if (!row) {
      next(new ApiError(401, 'SESSION_INVALID', 'Your session has expired. Sign in again.'));
      return;
    }

    request.user = {
      id: row.id,
      email: row.email,
      fullname: row.fullname,
      role: row.role,
    };
    request.sessionTokenHash = row.token_hash;
    next();
  };
}

export function requireRoles(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'));
      return;
    }
    if (!roles.includes(request.user.role)) {
      next(new ApiError(403, 'PERMISSION_DENIED', 'You do not have permission to do this.'));
      return;
    }
    next();
  };
}

export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get('origin');
  const requestOrigin = `${request.protocol}://${request.get('host')}`;
  const fetchSite = request.get('sec-fetch-site');

  if (
    !origin ||
    (origin !== requestOrigin &&
      !config.appOrigins.includes(origin) &&
      fetchSite !== 'same-origin')
  ) {
    next(new ApiError(403, 'UNTRUSTED_ORIGIN', 'Request origin is not trusted.'));
    return;
  }
  next();
};

export const requireTrustedOriginForMutations: RequestHandler = (
  request,
  response,
  next,
) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    next();
    return;
  }
  requireTrustedOrigin(request, response, next);
};

import { createHash, randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import { config } from '../config/env.js';

export const SESSION_COOKIE = 'books_session';

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(
  database: Database.Database,
  userId: number,
): string {
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    Date.now() + config.sessionDurationHours * 60 * 60 * 1000,
  ).toISOString();
  database
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashSessionToken(token), userId, expiresAt);
  return token;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: config.sessionDurationHours * 60 * 60 * 1000,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict' as const,
    path: '/',
  };
}

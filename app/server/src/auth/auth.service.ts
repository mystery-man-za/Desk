import type Database from 'better-sqlite3';
import { recordAuditEvent } from '../audit/audit.service.js';
import { ApiError } from '../errors/api-error.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSession } from './session.js';
import type { AuthenticatedUser, Role } from './auth.types.js';

export type PublicUser = AuthenticatedUser & { isActive: boolean };

export async function authenticate(
  database: Database.Database,
  email: string,
  password: string,
): Promise<{ user: PublicUser; token: string }> {
  const userRow = database
    .prepare(
      `SELECT id, email, fullname, password_hash, role, is_active
       FROM users WHERE email = ? COLLATE NOCASE`,
    )
    .get(email) as
    | {
        id: number;
        email: string;
        fullname: string;
        password_hash: string;
        role: Role;
        is_active: number;
      }
    | undefined;

  const dummyHash =
    'scrypt$16384$8$1$0123456789abcdef0123456789abcdef$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  const passwordMatches = await verifyPassword(
    password,
    userRow?.password_hash ?? dummyHash,
  );

  if (!userRow || userRow.is_active !== 1 || !passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const user = toPublicUser(userRow);
  return { user, token: createSession(database, user.id) };
}

export async function createInitialAdmin(
  database: Database.Database,
  input: { email: string; fullname: string; password: string },
): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  const create = database.transaction(() => {
    const count = database.prepare('SELECT COUNT(*) AS count FROM users').get() as {
      count: number;
    };
    if (count.count !== 0) {
      throw new ApiError(
        409,
        'INITIAL_ADMIN_ALREADY_EXISTS',
        'Users already exist; initial administrator bootstrap is only allowed once.',
      );
    }
    const result = database
      .prepare(
        `INSERT INTO users (email, fullname, password_hash, role)
         VALUES (?, ?, ?, 'System Manager')`,
      )
      .run(input.email, input.fullname, passwordHash);
    const userId = Number(result.lastInsertRowid);
    recordAuditEvent(database, {
      actorUserId: userId,
      eventType: 'user.initial_admin_created',
      entityType: 'user',
      entityId: userId,
      details: { email: input.email, role: 'System Manager' },
    });
  });
  try {
    create();
  } catch (error) {
    if (isConstraintError(error)) {
      throw new ApiError(
        409,
        'INITIAL_ADMIN_ALREADY_EXISTS',
        'An administrator was created concurrently; bootstrap was not completed.',
      );
    }
    throw error;
  }
}

export async function createUser(
  database: Database.Database,
  input: { email: string; fullname: string; password: string; role: Role },
  actorUserId: number,
): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);
  try {
    const create = database.transaction(() => {
      const result = database
        .prepare(
          `INSERT INTO users (email, fullname, password_hash, role)
           VALUES (?, ?, ?, ?)`,
        )
        .run(input.email, input.fullname, passwordHash, input.role);
      const userId = Number(result.lastInsertRowid);
      recordAuditEvent(database, {
        actorUserId,
        eventType: 'user.created',
        entityType: 'user',
        entityId: userId,
        details: { email: input.email, role: input.role },
      });
      return userId;
    });
    return getUser(database, create());
  } catch (error) {
    if (isConstraintError(error)) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'A user with this email already exists.');
    }
    throw error;
  }
}

export function listUsers(database: Database.Database): PublicUser[] {
  const rows = database
    .prepare('SELECT id, email, fullname, role, is_active FROM users ORDER BY id')
    .all();
  return rows.map(toPublicUser);
}

export function getUser(database: Database.Database, userId: number): PublicUser {
  const row = database
    .prepare('SELECT id, email, fullname, role, is_active FROM users WHERE id = ?')
    .get(userId);
  if (!row) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  return toPublicUser(row);
}

export function updateUser(
  database: Database.Database,
  userId: number,
  input: { role?: Role; isActive?: boolean },
  actorUserId: number,
): PublicUser {
  const update = database.transaction(() => {
    const user = database
      .prepare('SELECT id, role, is_active FROM users WHERE id = ?')
      .get(userId) as { id: number; role: Role; is_active: number } | undefined;
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');

    const nextRole = input.role ?? user.role;
    const nextActive = input.isActive ?? (user.is_active === 1);
    if (user.role === 'System Manager' && (nextRole !== 'System Manager' || !nextActive)) {
      const activeManagers = database
        .prepare(
          `SELECT COUNT(*) AS count FROM users
           WHERE role = 'System Manager' AND is_active = 1 AND id != ?`,
        )
        .get(userId) as { count: number };
      if (activeManagers.count === 0) {
        throw new ApiError(
          409,
          'LAST_SYSTEM_MANAGER',
          'The site must retain at least one active System Manager.',
        );
      }
    }

    database
      .prepare('UPDATE users SET role = ?, is_active = ? WHERE id = ?')
      .run(nextRole, Number(nextActive), userId);
    if (!nextActive) {
      database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    }
    recordAuditEvent(database, {
      actorUserId,
      eventType: 'user.updated',
      entityType: 'user',
      entityId: userId,
      details: { role: nextRole, isActive: nextActive },
    });
  });
  update();
  return getUser(database, userId);
}

export async function changePassword(
  database: Database.Database,
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = database
    .prepare('SELECT password_hash FROM users WHERE id = ? AND is_active = 1')
    .get(userId) as { password_hash: string } | undefined;
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw new ApiError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
  }

  const newHash = await hashPassword(newPassword);
  const update = database.transaction(() => {
    database
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(newHash, userId);
    database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    recordAuditEvent(database, {
      actorUserId: userId,
      eventType: 'user.password_changed',
      entityType: 'user',
      entityId: userId,
    });
  });
  update();
}

export async function resetUserPassword(
  database: Database.Database,
  userId: number,
  newPassword: string,
  actorUserId: number,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  const update = database.transaction(() => {
    const result = database
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, userId);
    if (result.changes === 0) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    recordAuditEvent(database, {
      actorUserId,
      eventType: 'user.password_reset',
      entityType: 'user',
      entityId: userId,
    });
  });
  update();
}

function toPublicUser(row: unknown): PublicUser {
  const user = row as {
    id: number;
    email: string;
    fullname: string;
    role: Role;
    is_active: number;
  };
  return {
    id: user.id,
    email: user.email,
    fullname: user.fullname,
    role: user.role,
    isActive: user.is_active === 1,
  };
}

function isConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('SQLITE_CONSTRAINT')
  );
}

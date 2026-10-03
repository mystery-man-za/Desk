import { Router } from 'express';
import type { Request } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { ApiError } from '../../errors/api-error.js';
import { requireRoles } from '../../auth/auth.middleware.js';
import { ACCOUNT_TYPES, ROOT_TYPES } from './types.js';
import { createAccount, listAccounts } from './accounts.service.js';

const companyIdSchema = z.coerce.number().int().positive();
const accountIdSchema = z.coerce.number().int().positive();
const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(140),
  code: z.string().trim().max(40).optional(),
  rootType: z.enum(ROOT_TYPES).optional(),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  parentId: z.number().int().positive().optional(),
  isGroup: z.boolean().default(false),
});

function parseId(value: string, label: string): number {
  const parsed = (label === 'company' ? companyIdSchema : accountIdSchema).safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, `INVALID_${label.toUpperCase()}_ID`, `${label} ID must be a positive integer.`);
  }
  return parsed.data;
}

export function createAccountsRouter(database: Database.Database): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (request: Request<{ companyId: string }>, response) => {
    const companyId = parseId(request.params.companyId, 'company');
    response.json({ accounts: listAccounts(database, companyId) });
  });

  router.post(
    '/',
    requireRoles('System Manager', 'Books Manager'),
    (request: Request<{ companyId: string }>, response) => {
    const companyId = parseId(request.params.companyId, 'company');
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Account details are invalid.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    const account = createAccount(
      database,
      companyId,
      request.user!.id,
      parsed.data,
    );
    response.status(201).json({ account });
    },
  );

  return router;
}

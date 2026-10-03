import type Database from 'better-sqlite3';
import { ApiError } from '../../errors/api-error.js';
import { recordAuditEvent } from '../../audit/audit.service.js';
import type { AccountRecord, RootType } from './types.js';

export function listAccounts(
  database: Database.Database,
  companyId: number,
): AccountRecord[] {
  assertCompanyExists(database, companyId);
  return database
    .prepare(
      `SELECT id, company_id, name, code, root_type, account_type,
              parent_id, is_group, created_at
       FROM accounts WHERE company_id = ?
       ORDER BY root_type, parent_id, name`,
    )
    .all(companyId)
    .map(mapAccount);
}

export function createAccount(
  database: Database.Database,
  companyId: number,
  actorUserId: number,
  input: {
    name: string;
    code?: string;
    rootType?: RootType;
    accountType?: string;
    parentId?: number;
    isGroup: boolean;
  },
): AccountRecord {
  const create = database.transaction(() => {
    assertCompanyExists(database, companyId);

    if (!input.parentId && !input.isGroup) {
      throw new ApiError(
        400,
        'ROOT_ACCOUNT_MUST_BE_GROUP',
        'Only group accounts can be root accounts.',
      );
    }

    let rootType = input.rootType;
    let accountType = input.accountType ?? null;
    if (input.parentId) {
      const parent = database
        .prepare(
          `SELECT root_type, account_type, is_group FROM accounts
           WHERE id = ? AND company_id = ?`,
        )
        .get(input.parentId, companyId) as
        | { root_type: RootType; account_type: string | null; is_group: number }
        | undefined;

      if (!parent) {
        throw new ApiError(404, 'PARENT_ACCOUNT_NOT_FOUND', 'Parent account not found.');
      }
      if (parent.is_group !== 1) {
        throw new ApiError(
          400,
          'PARENT_ACCOUNT_NOT_GROUP',
          'The parent account must be a group.',
        );
      }
      if (rootType && rootType !== parent.root_type) {
        throw new ApiError(
          400,
          'ROOT_TYPE_MISMATCH',
          'A child account must use its parent group root type.',
        );
      }

      rootType = parent.root_type;
      accountType = accountType ?? parent.account_type;
    }

    if (!rootType) {
      throw new ApiError(400, 'ROOT_TYPE_REQUIRED', 'Root accounts require a root type.');
    }

    const existing = database
      .prepare('SELECT 1 FROM accounts WHERE company_id = ? AND name = ?')
      .get(companyId, input.name);
    if (existing) {
      throw new ApiError(
        409,
        'DUPLICATE_ACCOUNT_NAME',
        'An account with this name already exists for the company.',
      );
    }

    const result = database
      .prepare(
        `INSERT INTO accounts (
           company_id, name, code, root_type, account_type, parent_id, is_group
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        companyId,
        input.name,
        input.code ?? null,
        rootType,
        accountType ?? null,
        input.parentId ?? null,
        Number(input.isGroup),
      );

    const accountId = Number(result.lastInsertRowid);
    recordAuditEvent(database, {
      actorUserId,
      eventType: 'account.created',
      entityType: 'account',
      entityId: accountId,
      details: { companyId, name: input.name, rootType, isGroup: input.isGroup },
    });
    return accountId;
  });

  try {
    return getAccount(database, companyId, create());
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      throw new ApiError(
        409,
        'DUPLICATE_ACCOUNT_NAME',
        'An account with this name already exists for the company.',
      );
    }
    throw error;
  }
}

export function getAccount(
  database: Database.Database,
  companyId: number,
  accountId: number,
): AccountRecord {
  const row = database
    .prepare(
      `SELECT id, company_id, name, code, root_type, account_type,
              parent_id, is_group, created_at
       FROM accounts WHERE id = ? AND company_id = ?`,
    )
    .get(accountId, companyId);
  if (!row) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found.');
  return mapAccount(row);
}

function assertCompanyExists(database: Database.Database, companyId: number): void {
  const company = database.prepare('SELECT 1 FROM companies WHERE id = ?').get(companyId);
  if (!company) {
    throw new ApiError(404, 'COMPANY_NOT_FOUND', 'Configured company not found.');
  }
}

function mapAccount(row: unknown): AccountRecord {
  const account = row as {
    id: number;
    company_id: number;
    name: string;
    code: string | null;
    root_type: RootType;
    account_type: string | null;
    parent_id: number | null;
    is_group: number;
    created_at: string;
  };
  return {
    id: account.id,
    companyId: account.company_id,
    name: account.name,
    code: account.code,
    rootType: account.root_type,
    accountType: account.account_type,
    parentId: account.parent_id,
    isGroup: account.is_group === 1,
    createdAt: account.created_at,
  };
}

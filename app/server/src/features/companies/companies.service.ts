import type Database from 'better-sqlite3';
import { ApiError } from '../../errors/api-error.js';
import { recordAuditEvent } from '../../audit/audit.service.js';
import { STARTER_CHART_ID, starterChart } from '../accounts/starter-chart.js';
import type { CreateCompanyInput } from './company.schemas.js';

export type CompanySummary = {
  id: number;
  name: string;
  setupComplete: boolean;
  createdAt: string;
};

export type CompanyDetails = CompanySummary & {
  fullname: string;
  email: string;
  country: string;
  currency: string;
  timeZone: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  chartId: string;
  bankAccountName: string;
};

export function listCompanies(database: Database.Database): CompanySummary[] {
  return database
    .prepare(
      `SELECT c.id, c.name, c.created_at,
              COALESCE(s.setup_complete, 0) AS setup_complete
       FROM companies c
       LEFT JOIN company_settings s ON s.company_id = c.id
       ORDER BY c.id`,
    )
    .all()
    .map((row) => {
      const company = row as {
        id: number;
        name: string;
        created_at: string;
        setup_complete: number;
      };
      return {
        id: company.id,
        name: company.name,
        setupComplete: company.setup_complete === 1,
        createdAt: company.created_at,
      };
    });
}

export function getCompany(
  database: Database.Database,
  companyId: number,
): CompanyDetails {
  const row = database
    .prepare(
      `SELECT c.id, c.name, c.created_at, s.setup_complete, s.fullname,
              s.email, s.country, s.currency, s.time_zone,
              s.fiscal_year_start, s.fiscal_year_end, s.chart_id,
              s.bank_account_name
       FROM companies c
       JOIN company_settings s ON s.company_id = c.id
       WHERE c.id = ?`,
    )
    .get(companyId) as
    | {
        id: number;
        name: string;
        created_at: string;
        setup_complete: number;
        fullname: string;
        email: string;
        country: string;
        currency: string;
        time_zone: string;
        fiscal_year_start: string;
        fiscal_year_end: string;
        chart_id: string;
        bank_account_name: string;
      }
    | undefined;

  if (!row) {
    throw new ApiError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
  }

  return {
    id: row.id,
    name: row.name,
    setupComplete: row.setup_complete === 1,
    createdAt: row.created_at,
    fullname: row.fullname,
    email: row.email,
    country: row.country,
    currency: row.currency,
    timeZone: row.time_zone,
    fiscalYearStart: row.fiscal_year_start,
    fiscalYearEnd: row.fiscal_year_end,
    chartId: row.chart_id,
    bankAccountName: row.bank_account_name,
  };
}

export function createCompany(
  database: Database.Database,
  input: CreateCompanyInput,
  actorUserId: number,
): CompanyDetails {
  if (input.chartId !== STARTER_CHART_ID) {
    throw new ApiError(400, 'UNSUPPORTED_CHART', 'The selected chart is not available.');
  }

  const existingCompany = database.prepare('SELECT 1 FROM companies LIMIT 1').get();
  if (existingCompany) {
    throw new ApiError(
      409,
      'COMPANY_ALREADY_CONFIGURED',
      'This site already has its Books company configured.',
    );
  }

  const create = database.transaction(() => {
    const companyInsert = database
      .prepare('INSERT INTO companies (name) VALUES (?)')
      .run(input.name);
    const companyId = Number(companyInsert.lastInsertRowid);

    database
      .prepare(
        `INSERT INTO company_settings (
           company_id, fullname, email, country, currency, time_zone,
           fiscal_year_start, fiscal_year_end, chart_id, bank_account_name
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        companyId,
        input.fullname,
        input.email,
        input.country,
        input.currency,
        input.timeZone,
        input.fiscalYearStart,
        input.fiscalYearEnd,
        input.chartId,
        input.bankAccountName,
      );

    insertStarterChart(database, companyId, input.bankAccountName);
    recordAuditEvent(database, {
      actorUserId,
      eventType: 'company.created',
      entityType: 'company',
      entityId: companyId,
      details: {
        name: input.name,
        country: input.country,
        currency: input.currency,
        chartId: input.chartId,
      },
    });
    return companyId;
  });

  let companyId: number;
  try {
    companyId = create();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.includes('companies_single_site_company_idx')
    ) {
      throw new ApiError(
        409,
        'COMPANY_ALREADY_CONFIGURED',
        'This site already has its Books company configured.',
      );
    }
    throw error;
  }
  return getCompany(database, companyId);
}

function insertStarterChart(
  database: Database.Database,
  companyId: number,
  bankAccountName: string,
): void {
  const insertedIds = new Map<string, number>();
  const chart = starterChart(bankAccountName);
  const accountsByName = new Map(chart.map((account) => [account.name, account]));
  const insertAccount = database.prepare(
    `INSERT INTO accounts (company_id, name, root_type, account_type, parent_id, is_group)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const account of chart) {
    const parentId = account.parentName
      ? insertedIds.get(account.parentName)
      : null;
    if (account.parentName && parentId === undefined) {
      throw new Error(`Starter chart parent ${account.parentName} has not been created.`);
    }
    const inheritedRootType = account.parentName
      ? accountsByName.get(account.parentName)?.rootType
      : account.rootType;
    if (account.parentName && inheritedRootType !== account.rootType) {
      throw new Error(`Starter chart account ${account.name} has an inconsistent root type.`);
    }
    if (insertedIds.has(account.name)) {
      throw new ApiError(
        409,
        'DUPLICATE_ACCOUNT_NAME',
        `The chart contains more than one account named "${account.name}".`,
      );
    }

    const result = insertAccount.run(
      companyId,
      account.name,
      account.rootType,
      account.accountType,
      parentId ?? null,
      Number(account.isGroup),
    );
    insertedIds.set(account.name, Number(result.lastInsertRowid));
  }
}

import { Router } from 'express';
import type { Request } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { ApiError } from '../../errors/api-error.js';
import { requireRoles } from '../../auth/auth.middleware.js';
import { createCompanySchema } from './company.schemas.js';
import { createCompany, getCompany, listCompanies } from './companies.service.js';

const companyIdSchema = z.coerce.number().int().positive();

function parseCompanyId(value: string): number {
  const parsed = companyIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_COMPANY_ID', 'Company ID must be a positive integer.');
  }
  return parsed.data;
}

function validationError(issues: z.ZodIssue[]): ApiError {
  return new ApiError(
    400,
    'VALIDATION_ERROR',
    'Company details are invalid.',
    issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  );
}

export function createCompaniesRouter(database: Database.Database): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({ companies: listCompanies(database) });
  });

  router.post(
    '/',
    requireRoles('System Manager', 'Books Manager'),
    (request: Request, response) => {
      const parsed = createCompanySchema.safeParse(request.body);
      if (!parsed.success) throw validationError(parsed.error.issues);

      const company = createCompany(database, parsed.data, request.user!.id);
      response.status(201).json({ company });
    },
  );

  router.get('/:companyId', (request, response) => {
    const company = getCompany(database, parseCompanyId(request.params.companyId));
    response.json({ company });
  });

  return router;
}

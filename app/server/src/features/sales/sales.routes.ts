import { Router } from 'express';
import type { Request } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { ApiError } from '../../errors/api-error.js';
import { requireRoles } from '../../auth/auth.middleware.js';
import {
  cancelSalesInvoice,
  createCustomer,
  createDraftSalesInvoice,
  getSalesInvoice,
  listCustomers,
  listSalesInvoices,
  submitSalesInvoice,
} from './sales.service.js';

const idSchema = z.coerce.number().int().positive();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  });
const customerSchema = z.object({
  name: z.string().trim().min(1).max(140),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
});
const invoiceSchema = z.object({
  customerId: z.number().int().positive(),
  receivableAccountId: z.number().int().positive(),
  invoiceDate: dateSchema,
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(240),
        quantityMilli: z.number().int().positive().max(1_000_000_000),
        unitPriceMinor: z.number().int().positive().max(1_000_000_000),
        incomeAccountId: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(100),
});

function parseId(value: string, label: string): number {
  const result = idSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, `INVALID_${label.toUpperCase()}_ID`, `${label} ID is invalid.`);
  }
  return result.data;
}

function parse<T>(schema: z.ZodType<T>, body: unknown, label: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${label} details are invalid.`,
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export function createSalesRouter(database: Database.Database): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/customers',
    (request: Request<{ companyId: string }>, response) => {
      response.json({
        customers: listCustomers(
          database,
          parseId(request.params.companyId, 'company'),
        ),
      });
    },
  );

  router.post(
    '/customers',
    requireRoles('System Manager', 'Books Manager', 'Books User'),
    (request: Request<{ companyId: string }>, response) => {
      const input = parse(customerSchema, request.body, 'Customer');
      const customer = createCustomer(
        database,
        parseId(request.params.companyId, 'company'),
        request.user!.id,
        { name: input.name, email: input.email || undefined },
      );
      response.status(201).json({ customer });
    },
  );

  router.get(
    '/invoices',
    (request: Request<{ companyId: string }>, response) => {
      response.json({
        invoices: listSalesInvoices(
          database,
          parseId(request.params.companyId, 'company'),
        ),
      });
    },
  );

  router.post(
    '/invoices',
    requireRoles('System Manager', 'Books Manager', 'Books User'),
    (request: Request<{ companyId: string }>, response) => {
      const input = parse(invoiceSchema, request.body, 'Sales invoice');
      const invoice = createDraftSalesInvoice(
        database,
        parseId(request.params.companyId, 'company'),
        request.user!.id,
        input,
      );
      response.status(201).json({ invoice });
    },
  );

  router.get(
    '/invoices/:invoiceId',
    (request: Request<{ companyId: string; invoiceId: string }>, response) => {
      response.json({
        invoice: getSalesInvoice(
          database,
          parseId(request.params.companyId, 'company'),
          parseId(request.params.invoiceId, 'invoice'),
        ),
      });
    },
  );

  router.post(
    '/invoices/:invoiceId/submit',
    requireRoles('System Manager', 'Books Manager', 'Books User'),
    (request: Request<{ companyId: string; invoiceId: string }>, response) => {
      const invoice = submitSalesInvoice(
        database,
        parseId(request.params.companyId, 'company'),
        parseId(request.params.invoiceId, 'invoice'),
        request.user!.id,
      );
      response.json({ invoice });
    },
  );

  router.post(
    '/invoices/:invoiceId/cancel',
    requireRoles('System Manager', 'Books Manager'),
    (request: Request<{ companyId: string; invoiceId: string }>, response) => {
      const invoice = cancelSalesInvoice(
        database,
        parseId(request.params.companyId, 'company'),
        parseId(request.params.invoiceId, 'invoice'),
        request.user!.id,
      );
      response.json({ invoice });
    },
  );

  return router;
}

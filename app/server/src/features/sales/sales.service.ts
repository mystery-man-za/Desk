import type Database from 'better-sqlite3';
import { recordAuditEvent } from '../../audit/audit.service.js';
import { ApiError } from '../../errors/api-error.js';

export type Customer = {
  id: number;
  name: string;
  email: string | null;
  role: 'Customer' | 'Supplier' | 'Both';
};

export type InvoiceLineInput = {
  description: string;
  quantityMilli: number;
  unitPriceMinor: number;
  incomeAccountId: number;
};

export type SalesInvoiceSummary = {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  invoiceDate: string;
  receivableAccountId: number | null;
  receivableAccountName: string | null;
  currency: string;
  currencyPrecision: number;
  subtotalMinor: number;
  status: 'Draft' | 'Submitted' | 'Cancelled';
  createdAt: string;
};

export type SalesInvoiceDetails = SalesInvoiceSummary & {
  lines: Array<{
    id: number;
    description: string;
    quantityMilli: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    incomeAccountId: number;
    incomeAccountName: string;
  }>;
  journalEntries: Array<{
    id: number;
    entryDate: string;
    description: string;
    sourceType: 'Sales Invoice' | 'Reversal';
    lines: Array<{
      accountId: number;
      accountName: string;
      debitMinor: number;
      creditMinor: number;
    }>;
  }>;
};

type DraftRow = {
  id: number;
  company_id: number;
  customer_id: number;
  receivable_account_id: number | null;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  subtotal_minor: number;
  status: SalesInvoiceSummary['status'];
  created_at: string;
  customer_name: string;
  receivable_account_name: string | null;
};

export function listCustomers(
  database: Database.Database,
  companyId: number,
): Customer[] {
  assertCompanyExists(database, companyId);
  return database
    .prepare(
      `SELECT id, name, email, role
       FROM customers WHERE company_id = ?
       ORDER BY name COLLATE NOCASE, id`,
    )
    .all(companyId)
    .map(mapCustomer);
}

export function createCustomer(
  database: Database.Database,
  companyId: number,
  actorUserId: number,
  input: { name: string; email?: string },
): Customer {
  assertCompanyExists(database, companyId);
  try {
    const create = database.transaction(() => {
      const result = database
        .prepare(
          'INSERT INTO customers (company_id, name, email, role) VALUES (?, ?, ?, ?)',
        )
        .run(companyId, input.name, input.email || null, 'Customer');
      const customerId = Number(result.lastInsertRowid);
      recordAuditEvent(database, {
        actorUserId,
        eventType: 'customer.created',
        entityType: 'customer',
        entityId: customerId,
        details: { companyId, name: input.name },
      });
      return customerId;
    });
    return getCustomer(database, companyId, create());
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new ApiError(
        409,
        'DUPLICATE_CUSTOMER',
        'A customer with this name already exists for the company.',
      );
    }
    throw error;
  }
}

export function listSalesInvoices(
  database: Database.Database,
  companyId: number,
): SalesInvoiceSummary[] {
  assertCompanyExists(database, companyId);
  return database
    .prepare(
      `SELECT i.id, i.company_id, i.customer_id, i.receivable_account_id,
              i.invoice_number, i.invoice_date, i.currency, i.subtotal_minor,
              i.status, i.created_at, c.name AS customer_name,
              a.name AS receivable_account_name
       FROM sales_invoices i
       JOIN customers c ON c.id = i.customer_id AND c.company_id = i.company_id
       LEFT JOIN accounts a ON a.id = i.receivable_account_id AND a.company_id = i.company_id
       WHERE i.company_id = ?
       ORDER BY i.invoice_date DESC, i.id DESC`,
    )
    .all(companyId)
    .map((row) => mapInvoice(row as DraftRow));
}

export function getSalesInvoice(
  database: Database.Database,
  companyId: number,
  invoiceId: number,
): SalesInvoiceDetails {
  const row = database
    .prepare(
      `SELECT i.id, i.company_id, i.customer_id, i.receivable_account_id,
              i.invoice_number, i.invoice_date, i.currency, i.subtotal_minor,
              i.status, i.created_at, c.name AS customer_name,
              a.name AS receivable_account_name
       FROM sales_invoices i
       JOIN customers c ON c.id = i.customer_id AND c.company_id = i.company_id
       LEFT JOIN accounts a ON a.id = i.receivable_account_id AND a.company_id = i.company_id
       WHERE i.id = ? AND i.company_id = ?`,
    )
    .get(invoiceId, companyId) as DraftRow | undefined;
  if (!row) throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Sales invoice not found.');

  const lines = database
    .prepare(
      `SELECT l.id, l.description, l.quantity_milli, l.unit_price_minor,
              l.line_total_minor, l.income_account_id, a.name AS income_account_name
       FROM sales_invoice_lines l
       JOIN accounts a ON a.id = l.income_account_id
       WHERE l.invoice_id = ? ORDER BY l.id`,
    )
    .all(invoiceId)
    .map((line) => {
      const value = line as {
        id: number;
        description: string;
        quantity_milli: number;
        unit_price_minor: number;
        line_total_minor: number;
        income_account_id: number;
        income_account_name: string;
      };
      return {
        id: value.id,
        description: value.description,
        quantityMilli: value.quantity_milli,
        unitPriceMinor: value.unit_price_minor,
        lineTotalMinor: value.line_total_minor,
        incomeAccountId: value.income_account_id,
        incomeAccountName: value.income_account_name,
      };
    });

  const journalEntries = database
    .prepare(
      `SELECT id, entry_date, description, source_type
       FROM journal_entries
       WHERE company_id = ? AND source_type = 'Sales Invoice' AND source_id = ?
       UNION ALL
       SELECT id, entry_date, description, source_type
       FROM journal_entries
       WHERE company_id = ? AND source_type = 'Reversal'
         AND reverses_entry_id = (
           SELECT id FROM journal_entries
           WHERE company_id = ? AND source_type = 'Sales Invoice' AND source_id = ?
         )
       ORDER BY id`,
    )
    .all(companyId, invoiceId, companyId, companyId, invoiceId)
    .map((entry) => {
      const value = entry as {
        id: number;
        entry_date: string;
        description: string;
        source_type: 'Sales Invoice' | 'Reversal';
      };
      const entryLines = database
        .prepare(
          `SELECT l.account_id, a.name AS account_name,
                  l.debit_minor, l.credit_minor
           FROM journal_lines l
           JOIN accounts a ON a.id = l.account_id
           WHERE l.journal_entry_id = ? ORDER BY l.id`,
        )
        .all(value.id)
        .map((entryLine) => {
          const line = entryLine as {
            account_id: number;
            account_name: string;
            debit_minor: number;
            credit_minor: number;
          };
          return {
            accountId: line.account_id,
            accountName: line.account_name,
            debitMinor: line.debit_minor,
            creditMinor: line.credit_minor,
          };
        });
      return {
        id: value.id,
        entryDate: value.entry_date,
        description: value.description,
        sourceType: value.source_type,
        lines: entryLines,
      };
    });

  return { ...mapInvoice(row), lines, journalEntries };
}

export function createDraftSalesInvoice(
  database: Database.Database,
  companyId: number,
  actorUserId: number,
  input: {
    customerId: number;
    receivableAccountId: number;
    invoiceDate: string;
    lines: InvoiceLineInput[];
  },
): SalesInvoiceDetails {
  const create = database.transaction(() => {
    const company = database
      .prepare(
        `SELECT c.id, s.currency, s.fiscal_year_start, s.fiscal_year_end,
                s.invoice_series_next
         FROM companies c JOIN company_settings s ON s.company_id = c.id
         WHERE c.id = ?`,
      )
      .get(companyId) as
      | {
          id: number;
          currency: string;
          fiscal_year_start: string;
          fiscal_year_end: string;
          invoice_series_next: number;
        }
      | undefined;
    if (!company) throw new ApiError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
    if (
      input.invoiceDate < company.fiscal_year_start ||
      input.invoiceDate > company.fiscal_year_end
    ) {
      throw new ApiError(
        400,
        'INVOICE_OUTSIDE_FISCAL_YEAR',
        'The invoice date must be within the configured fiscal year.',
      );
    }
    const customer = database
      .prepare(
        `SELECT 1 FROM customers
         WHERE id = ? AND company_id = ? AND role IN ('Customer', 'Both')`,
      )
      .get(input.customerId, companyId);
    if (!customer) {
      throw new ApiError(400, 'INVALID_CUSTOMER', 'Select a customer party.');
    }
    const receivableAccount = database
      .prepare(
        `SELECT id FROM accounts
         WHERE id = ? AND company_id = ? AND root_type = 'Asset'
           AND account_type = 'Receivable' AND is_group = 0`,
      )
      .get(input.receivableAccountId, companyId);
    if (!receivableAccount) {
      throw new ApiError(
        400,
        'INVALID_RECEIVABLE_ACCOUNT',
        'Select an Accounts Receivable ledger account.',
      );
    }

    const calculatedLines = input.lines.map((line) => {
      const account = database
        .prepare(
          `SELECT 1 FROM accounts
           WHERE id = ? AND company_id = ? AND root_type = 'Income'
             AND is_group = 0`,
        )
        .get(line.incomeAccountId, companyId);
      if (!account) {
        throw new ApiError(
          400,
          'INVALID_INCOME_ACCOUNT',
          'Each invoice line must use an income ledger account.',
        );
      }
      const preciseLineTotal =
        (BigInt(line.quantityMilli) * BigInt(line.unitPriceMinor) + 500n) / 1000n;
      if (preciseLineTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new ApiError(
          400,
          'INVALID_LINE_TOTAL',
          'Each invoice line must total at least one minor currency unit.',
        );
      }
      const lineTotalMinor = Number(preciseLineTotal);
      if (lineTotalMinor < 1) {
        throw new ApiError(
          400,
          'INVALID_LINE_TOTAL',
          'Each invoice line must total at least one minor currency unit.',
        );
      }
      return { ...line, lineTotalMinor };
    });
    const preciseSubtotal = calculatedLines.reduce(
      (total, line) => total + BigInt(line.lineTotalMinor),
      0n,
    );
    if (preciseSubtotal > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ApiError(400, 'INVALID_INVOICE_TOTAL', 'Invoice total is invalid.');
    }
    const subtotalMinor = Number(preciseSubtotal);
    if (subtotalMinor < 1) {
      throw new ApiError(400, 'INVALID_INVOICE_TOTAL', 'Invoice total is invalid.');
    }

    const seriesNumber = company.invoice_series_next;
    const updateSeries = database
      .prepare(
        `UPDATE company_settings SET invoice_series_next = ?
         WHERE company_id = ? AND invoice_series_next = ?`,
      )
      .run(seriesNumber + 1, companyId, seriesNumber);
    if (updateSeries.changes !== 1) {
      throw new Error('Invoice number series could not be advanced.');
    }
    const insert = database
      .prepare(
        `INSERT INTO sales_invoices (
           company_id, customer_id, receivable_account_id, invoice_number,
           invoice_date, due_date, currency, subtotal_minor, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        companyId,
        input.customerId,
        input.receivableAccountId,
        `SINV-${String(seriesNumber).padStart(4, '0')}`,
        input.invoiceDate,
        input.invoiceDate,
        company.currency,
        subtotalMinor,
        actorUserId,
      );
    const invoiceId = Number(insert.lastInsertRowid);

    const insertLine = database.prepare(
      `INSERT INTO sales_invoice_lines (
         invoice_id, company_id, description, quantity_milli, unit_price_minor,
         line_total_minor, income_account_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const line of calculatedLines) {
      insertLine.run(
        invoiceId,
        companyId,
        line.description,
        line.quantityMilli,
        line.unitPriceMinor,
        line.lineTotalMinor,
        line.incomeAccountId,
      );
    }
    recordAuditEvent(database, {
      actorUserId,
      eventType: 'sales_invoice.created',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      details: { companyId, customerId: input.customerId, subtotalMinor },
    });
    return invoiceId;
  });
  return getSalesInvoice(database, companyId, create.immediate());
}

export function submitSalesInvoice(
  database: Database.Database,
  companyId: number,
  invoiceId: number,
  actorUserId: number,
): SalesInvoiceDetails {
  const submit = database.transaction(() => {
    const invoice = getInvoiceRow(database, companyId, invoiceId);
    if (invoice.status !== 'Draft') {
      throw new ApiError(
        409,
        'INVOICE_NOT_DRAFT',
        'Only a draft invoice can be submitted.',
      );
    }
    const receivableAccount = database
      .prepare(
        `SELECT id FROM accounts
         WHERE id = ? AND company_id = ? AND account_type = 'Receivable'
           AND root_type = 'Asset' AND is_group = 0`,
      )
      .get(invoice.receivable_account_id, companyId) as { id: number } | undefined;
    if (!receivableAccount) {
      throw new ApiError(409, 'RECEIVABLE_ACCOUNT_UNAVAILABLE', 'The selected receivable ledger account is unavailable.');
    }
    const lines = database
      .prepare(
        `SELECT l.income_account_id, SUM(l.line_total_minor) AS amount_minor,
                a.is_group, a.root_type
         FROM sales_invoice_lines l
         JOIN accounts a ON a.id = l.income_account_id
         WHERE l.invoice_id = ?
         GROUP BY l.income_account_id`,
      )
      .all(invoiceId) as Array<{
      income_account_id: number;
      amount_minor: number;
      is_group: number;
      root_type: string;
    }>;
    if (
      lines.length === 0 ||
      lines.some(
        (line) =>
          line.is_group !== 0 ||
          line.root_type !== 'Income',
      )
    ) {
      throw new ApiError(
        409,
        'INCOME_ACCOUNT_UNAVAILABLE',
        'Every invoice income account must still be a usable ledger account.',
      );
    }
    const total = lines.reduce((sum, line) => sum + line.amount_minor, 0);
    if (total !== invoice.subtotal_minor) {
      throw new Error('Invoice line totals do not match the saved invoice total.');
    }

    const entryId = insertJournalEntry(database, {
      companyId,
      entryDate: invoice.invoice_date,
      description: `${invoice.invoice_number} - ${invoice.customer_name}`,
      sourceType: 'Sales Invoice',
      sourceId: invoiceId,
      actorUserId,
    });
    insertJournalLine(database, entryId, companyId, receivableAccount.id, total, 0);
    for (const line of lines) {
      insertJournalLine(
        database,
        entryId,
        companyId,
        line.income_account_id,
        0,
        line.amount_minor,
      );
    }
    assertJournalBalanced(database, entryId);
    database
      .prepare(`UPDATE sales_invoices SET status = 'Submitted' WHERE id = ?`)
      .run(invoiceId);
    recordAuditEvent(database, {
      actorUserId,
      eventType: 'sales_invoice.submitted',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      details: { companyId, journalEntryId: entryId, totalMinor: total },
    });
  });
  try {
    submit.immediate();
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new ApiError(
        409,
        'INVOICE_ALREADY_POSTED',
        'This invoice has already been posted.',
      );
    }
    throw error;
  }
  return getSalesInvoice(database, companyId, invoiceId);
}

export function cancelSalesInvoice(
  database: Database.Database,
  companyId: number,
  invoiceId: number,
  actorUserId: number,
): SalesInvoiceDetails {
  const cancel = database.transaction(() => {
    const invoice = getInvoiceRow(database, companyId, invoiceId);
    if (invoice.status !== 'Submitted') {
      throw new ApiError(
        409,
        'INVOICE_NOT_SUBMITTED',
        'Only a submitted invoice can be cancelled.',
      );
    }
    const originalEntry = database
      .prepare(
        `SELECT id FROM journal_entries
         WHERE company_id = ? AND source_type = 'Sales Invoice' AND source_id = ?`,
      )
      .get(companyId, invoiceId) as { id: number } | undefined;
    if (!originalEntry) throw new Error('Submitted invoice has no original journal entry.');
    const originalLines = database
      .prepare(
        `SELECT account_id, debit_minor, credit_minor
         FROM journal_lines WHERE journal_entry_id = ?`,
      )
      .all(originalEntry.id) as Array<{
      account_id: number;
      debit_minor: number;
      credit_minor: number;
    }>;
    const reversalId = insertJournalEntry(database, {
      companyId,
      entryDate: invoice.invoice_date,
      description: `Reversal of ${invoice.invoice_number}`,
      sourceType: 'Reversal',
      sourceId: invoiceId,
      reversesEntryId: originalEntry.id,
      actorUserId,
    });
    for (const line of originalLines) {
      insertJournalLine(
        database,
        reversalId,
        companyId,
        line.account_id,
        line.credit_minor,
        line.debit_minor,
      );
    }
    assertJournalBalanced(database, reversalId);
    database
      .prepare(`UPDATE sales_invoices SET status = 'Cancelled' WHERE id = ?`)
      .run(invoiceId);
    recordAuditEvent(database, {
      actorUserId,
      eventType: 'sales_invoice.cancelled',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      details: { companyId, reversalJournalEntryId: reversalId },
    });
  });
  cancel.immediate();
  return getSalesInvoice(database, companyId, invoiceId);
}

function insertJournalEntry(
  database: Database.Database,
  input: {
    companyId: number;
    entryDate: string;
    description: string;
    sourceType: 'Sales Invoice' | 'Reversal';
    sourceId: number;
    reversesEntryId?: number;
    actorUserId: number;
  },
): number {
  const result = database
    .prepare(
      `INSERT INTO journal_entries (
         company_id, entry_date, description, source_type, source_id,
         reverses_entry_id, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.companyId,
      input.entryDate,
      input.description,
      input.sourceType,
      input.sourceId,
      input.reversesEntryId ?? null,
      input.actorUserId,
    );
  return Number(result.lastInsertRowid);
}

function insertJournalLine(
  database: Database.Database,
  entryId: number,
  companyId: number,
  accountId: number,
  debitMinor: number,
  creditMinor: number,
): void {
  database
    .prepare(
      `INSERT INTO journal_lines (
         journal_entry_id, company_id, account_id, debit_minor, credit_minor
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(entryId, companyId, accountId, debitMinor, creditMinor);
}

function assertJournalBalanced(
  database: Database.Database,
  entryId: number,
): void {
  const totals = database
    .prepare(
      `SELECT COUNT(*) AS line_count, SUM(debit_minor) AS debits,
              SUM(credit_minor) AS credits
       FROM journal_lines WHERE journal_entry_id = ?`,
    )
    .get(entryId) as {
    line_count: number;
    debits: number | null;
    credits: number | null;
  };
  if (
    totals.line_count < 2 ||
    totals.debits === null ||
    totals.credits === null ||
    totals.debits !== totals.credits
  ) {
    throw new Error(`Journal entry ${entryId} is not balanced.`);
  }
}

function getInvoiceRow(
  database: Database.Database,
  companyId: number,
  invoiceId: number,
): DraftRow {
  const row = database
    .prepare(
      `SELECT i.id, i.company_id, i.customer_id, i.receivable_account_id,
              i.invoice_number, i.invoice_date, i.currency, i.subtotal_minor,
              i.status, i.created_at, c.name AS customer_name,
              a.name AS receivable_account_name
       FROM sales_invoices i
       JOIN customers c ON c.id = i.customer_id AND c.company_id = i.company_id
       LEFT JOIN accounts a ON a.id = i.receivable_account_id AND a.company_id = i.company_id
       WHERE i.id = ? AND i.company_id = ?`,
    )
    .get(invoiceId, companyId) as DraftRow | undefined;
  if (!row) throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Sales invoice not found.');
  return row;
}

function getCustomer(
  database: Database.Database,
  companyId: number,
  customerId: number,
): Customer {
  const row = database
    .prepare(
      `SELECT id, name, email, role
       FROM customers WHERE id = ? AND company_id = ?`,
    )
    .get(customerId, companyId);
  if (!row) throw new Error('Customer created but could not be loaded.');
  return mapCustomer(row);
}

function mapCustomer(row: unknown): Customer {
  const customer = row as {
    id: number;
    name: string;
    email: string | null;
    role: Customer['role'];
  };
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    role: customer.role,
  };
}

function mapInvoice(row: DraftRow): SalesInvoiceSummary {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    invoiceDate: row.invoice_date,
    receivableAccountId: row.receivable_account_id,
    receivableAccountName: row.receivable_account_name,
    currency: row.currency,
    currencyPrecision: getCurrencyPrecision(row.currency),
    subtotalMinor: row.subtotal_minor,
    status: row.status,
    createdAt: row.created_at,
  };
}

function getCurrencyPrecision(currency: string): number {
  try {
    const precision = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
    if (precision === undefined) {
      throw new Error(`Currency "${currency}" has no defined minor-unit precision.`);
    }
    return precision;
  } catch (error) {
    throw new Error(`Unsupported invoice currency "${currency}".`, { cause: error });
  }
}

function assertCompanyExists(database: Database.Database, companyId: number): void {
  if (!database.prepare('SELECT 1 FROM companies WHERE id = ?').get(companyId)) {
    throw new ApiError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

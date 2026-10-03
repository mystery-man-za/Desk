import type Database from 'better-sqlite3';

const migrations = [
  // Published migrations are append-only; never reorder or rewrite an applied version.
  `
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE TABLE company_settings (
      company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      fullname TEXT NOT NULL,
      email TEXT NOT NULL,
      country TEXT NOT NULL,
      currency TEXT NOT NULL CHECK (length(currency) = 3),
      time_zone TEXT NOT NULL,
      fiscal_year_start TEXT NOT NULL,
      fiscal_year_end TEXT NOT NULL,
      chart_id TEXT NOT NULL,
      bank_account_name TEXT NOT NULL,
      setup_complete INTEGER NOT NULL DEFAULT 1 CHECK (setup_complete IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (fiscal_year_end > fiscal_year_start)
    );

    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      code TEXT,
      root_type TEXT NOT NULL CHECK (
        root_type IN ('Asset', 'Liability', 'Equity', 'Income', 'Expense')
      ),
      account_type TEXT,
      parent_id INTEGER,
      is_group INTEGER NOT NULL CHECK (is_group IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (company_id, name),
      UNIQUE (id, company_id),
      FOREIGN KEY (parent_id, company_id)
        REFERENCES accounts(id, company_id) ON DELETE RESTRICT,
      CHECK (parent_id IS NOT NULL OR is_group = 1)
    );

    CREATE INDEX accounts_company_parent_idx ON accounts(company_id, parent_id);
    CREATE INDEX accounts_company_root_idx ON accounts(company_id, root_type);
  `,
  `
    CREATE UNIQUE INDEX companies_single_site_company_idx
      ON companies ((1));

    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      fullname TEXT NOT NULL CHECK (length(trim(fullname)) > 0),
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('System Manager', 'Books Manager', 'Books User')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX sessions_user_idx ON sessions(user_id);
    CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
  `,
  `
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id),
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(details) AND json_type(details) = 'object'),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX audit_events_entity_idx
      ON audit_events(entity_type, entity_id, id);
    CREATE INDEX audit_events_actor_idx
      ON audit_events(actor_user_id, id);

    CREATE TRIGGER audit_events_no_update
      BEFORE UPDATE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit events are append-only');
      END;

    CREATE TRIGGER audit_events_no_delete
      BEFORE DELETE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit events are append-only');
      END;
  `,
  `
    CREATE TRIGGER accounts_parent_group_insert
      BEFORE INSERT ON accounts
      WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM accounts
        WHERE id = NEW.parent_id
          AND company_id = NEW.company_id
          AND is_group = 1
      )
      BEGIN
        SELECT RAISE(ABORT, 'account parent must be a group in the same company');
      END;

    CREATE TRIGGER accounts_root_type_insert
      BEFORE INSERT ON accounts
      WHEN NEW.parent_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM accounts
        WHERE id = NEW.parent_id
          AND company_id = NEW.company_id
          AND root_type != NEW.root_type
      )
      BEGIN
        SELECT RAISE(ABORT, 'account root type must match its parent');
      END;

    CREATE TRIGGER accounts_parent_group_update
      BEFORE UPDATE OF parent_id, company_id ON accounts
      WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM accounts
        WHERE id = NEW.parent_id
          AND company_id = NEW.company_id
          AND is_group = 1
      )
      BEGIN
        SELECT RAISE(ABORT, 'account parent must be a group in the same company');
      END;

    CREATE TRIGGER accounts_root_type_update
      BEFORE UPDATE OF root_type, parent_id, company_id ON accounts
      WHEN NEW.parent_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM accounts
        WHERE id = NEW.parent_id
          AND company_id = NEW.company_id
          AND root_type != NEW.root_type
      )
      BEGIN
        SELECT RAISE(ABORT, 'account root type must match its parent');
      END;

    CREATE TRIGGER accounts_group_with_children_update
      BEFORE UPDATE OF is_group ON accounts
      WHEN NEW.is_group = 0 AND EXISTS (
        SELECT 1 FROM accounts WHERE parent_id = OLD.id
      )
      BEGIN
        SELECT RAISE(ABORT, 'account with children must remain a group');
      END;
  `,
  `
    CREATE TRIGGER accounts_parent_type_insert
      BEFORE INSERT ON accounts
      WHEN NEW.parent_id IS NOT NULL AND NEW.account_type IS NULL AND EXISTS (
        SELECT 1 FROM accounts
        WHERE id = NEW.parent_id
          AND company_id = NEW.company_id
          AND account_type IS NOT NULL
      )
      BEGIN
        SELECT RAISE(ABORT, 'account type must inherit from its parent when omitted');
      END;

    CREATE TRIGGER accounts_parent_type_update
      BEFORE UPDATE OF account_type, parent_id, company_id ON accounts
      WHEN NEW.parent_id IS NOT NULL AND NEW.account_type IS NULL AND EXISTS (
        SELECT 1 FROM accounts
        WHERE id = NEW.parent_id
          AND company_id = NEW.company_id
          AND account_type IS NOT NULL
      )
      BEGIN
        SELECT RAISE(ABORT, 'account type must inherit from its parent when omitted');
      END;
  `,
  `
      ALTER TABLE accounts
        ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
      ALTER TABLE accounts
        ADD COLUMN is_protected INTEGER NOT NULL DEFAULT 0 CHECK (is_protected IN (0, 1));
      UPDATE accounts SET is_protected = 1
      WHERE parent_id IS NULL
         OR account_type IN ('Receivable', 'Payable', 'Equity')
         OR name = 'Sales Revenue';

    CREATE TRIGGER accounts_code_unique_insert
      BEFORE INSERT ON accounts
      WHEN NEW.code IS NOT NULL AND EXISTS (
          SELECT 1 FROM accounts
          WHERE company_id = NEW.company_id AND code = NEW.code
      )
      BEGIN
          SELECT RAISE(ABORT, 'account code must be unique within a company');
      END;
    CREATE TRIGGER accounts_code_unique_update
      BEFORE UPDATE OF code, company_id ON accounts
      WHEN NEW.code IS NOT NULL AND EXISTS (
          SELECT 1 FROM accounts
          WHERE company_id = NEW.company_id AND code = NEW.code AND id != OLD.id
      )
      BEGIN
          SELECT RAISE(ABORT, 'account code must be unique within a company');
      END;
    CREATE TRIGGER accounts_active_parent_insert
      BEFORE INSERT ON accounts
      WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM accounts
          WHERE id = NEW.parent_id AND company_id = NEW.company_id AND is_active = 1
      )
      BEGIN
          SELECT RAISE(ABORT, 'active accounts require an active parent');
      END;
    CREATE TRIGGER accounts_active_parent_update
      BEFORE UPDATE OF is_active, parent_id, company_id ON accounts
      WHEN NEW.is_active = 1 AND NEW.parent_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM accounts
          WHERE id = NEW.parent_id AND company_id = NEW.company_id AND is_active = 1
      )
      BEGIN
          SELECT RAISE(ABORT, 'active accounts require an active parent');
      END;
    CREATE TRIGGER accounts_active_children_no_deactivation
      BEFORE UPDATE OF is_active ON accounts
      WHEN NEW.is_active = 0 AND EXISTS (
          SELECT 1 FROM accounts
          WHERE parent_id = OLD.id AND company_id = OLD.company_id AND is_active = 1
      )
      BEGIN
          SELECT RAISE(ABORT, 'accounts with active children cannot be deactivated');
      END;

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        email TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (id, company_id),
        UNIQUE (company_id, name)
      );
      CREATE INDEX customers_company_active_idx ON customers(company_id, is_active);

      CREATE TABLE sales_invoices (
        id INTEGER PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
        customer_id INTEGER NOT NULL,
        invoice_number TEXT NOT NULL,
        invoice_date TEXT NOT NULL CHECK (
          length(invoice_date) = 10 AND date(invoice_date) = invoice_date
        ),
        due_date TEXT NOT NULL CHECK (
          length(due_date) = 10 AND date(due_date) = due_date
        ),
        currency TEXT NOT NULL CHECK (length(currency) = 3),
        subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor > 0),
        status TEXT NOT NULL DEFAULT 'Draft'
          CHECK (status IN ('Draft', 'Submitted', 'Cancelled')),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (company_id, invoice_number),
        UNIQUE (id, company_id),
        FOREIGN KEY (customer_id, company_id)
          REFERENCES customers(id, company_id) ON DELETE RESTRICT,
        CHECK (due_date >= invoice_date)
      );
      CREATE INDEX sales_invoices_company_date_idx
        ON sales_invoices(company_id, invoice_date DESC, id DESC);

      CREATE TABLE sales_invoice_lines (
        id INTEGER PRIMARY KEY,
        invoice_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        description TEXT NOT NULL CHECK (length(trim(description)) > 0),
        quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
        line_total_minor INTEGER NOT NULL CHECK (line_total_minor > 0),
        income_account_id INTEGER NOT NULL,
        FOREIGN KEY (invoice_id, company_id)
          REFERENCES sales_invoices(id, company_id) ON DELETE RESTRICT,
        FOREIGN KEY (income_account_id, company_id)
          REFERENCES accounts(id, company_id) ON DELETE RESTRICT
      );
      CREATE INDEX sales_invoice_lines_invoice_idx
        ON sales_invoice_lines(invoice_id, company_id, id);

      CREATE TABLE journal_entries (
        id INTEGER PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
        entry_date TEXT NOT NULL CHECK (
          length(entry_date) = 10 AND date(entry_date) = entry_date
        ),
        description TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('Sales Invoice', 'Reversal')),
        source_id INTEGER NOT NULL,
        reverses_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE RESTRICT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (id, company_id),
        UNIQUE (source_type, source_id),
        UNIQUE (reverses_entry_id),
        CHECK (
          (source_type = 'Sales Invoice' AND reverses_entry_id IS NULL)
          OR (source_type = 'Reversal' AND reverses_entry_id IS NOT NULL)
        )
      );
      CREATE INDEX journal_entries_company_date_idx
        ON journal_entries(company_id, entry_date DESC, id DESC);

      CREATE TABLE journal_lines (
        id INTEGER PRIMARY KEY,
        journal_entry_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        debit_minor INTEGER NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
        credit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
        UNIQUE (id, company_id),
        FOREIGN KEY (journal_entry_id, company_id)
          REFERENCES journal_entries(id, company_id) ON DELETE RESTRICT,
        FOREIGN KEY (account_id, company_id)
          REFERENCES accounts(id, company_id) ON DELETE RESTRICT,
        CHECK (
          (debit_minor > 0 AND credit_minor = 0)
          OR (credit_minor > 0 AND debit_minor = 0)
        )
      );
      CREATE INDEX journal_lines_entry_idx ON journal_lines(journal_entry_id, id);
      CREATE INDEX journal_lines_account_idx ON journal_lines(account_id, company_id);

      CREATE TRIGGER journal_entries_no_update
        BEFORE UPDATE ON journal_entries
        BEGIN
          SELECT RAISE(ABORT, 'journal entries are immutable');
        END;
      CREATE TRIGGER journal_entries_no_delete
        BEFORE DELETE ON journal_entries
        BEGIN
          SELECT RAISE(ABORT, 'journal entries are immutable');
        END;
      CREATE TRIGGER journal_lines_no_update
        BEFORE UPDATE ON journal_lines
        BEGIN
          SELECT RAISE(ABORT, 'journal lines are immutable');
        END;
      CREATE TRIGGER journal_lines_no_delete
        BEFORE DELETE ON journal_lines
        BEGIN
          SELECT RAISE(ABORT, 'journal lines are immutable');
        END;
      CREATE TRIGGER protected_accounts_no_deactivation
        BEFORE UPDATE OF is_active ON accounts
        WHEN OLD.is_protected = 1 AND NEW.is_active = 0
        BEGIN
          SELECT RAISE(ABORT, 'protected accounts cannot be deactivated');
        END;
      CREATE TRIGGER ledger_accounts_with_activity_no_deactivation
        BEFORE UPDATE OF is_active ON accounts
        WHEN NEW.is_active = 0 AND EXISTS (
          SELECT 1 FROM journal_lines
          WHERE account_id = OLD.id AND company_id = OLD.company_id
        )
        BEGIN
          SELECT RAISE(ABORT, 'accounts with ledger activity cannot be deactivated');
        END;
      CREATE TRIGGER protected_accounts_no_rename
        BEFORE UPDATE OF name ON accounts
        WHEN OLD.is_protected = 1 AND NEW.name != OLD.name
        BEGIN
          SELECT RAISE(ABORT, 'protected account names cannot be changed');
        END;

      CREATE TRIGGER sales_invoice_status_transition
        BEFORE UPDATE OF status ON sales_invoices
        WHEN NOT (
          (OLD.status = 'Draft' AND NEW.status = 'Submitted')
          OR (OLD.status = 'Submitted' AND NEW.status = 'Cancelled')
        )
        BEGIN
          SELECT RAISE(ABORT, 'invalid sales invoice status transition');
        END;
      CREATE TRIGGER submitted_sales_invoice_is_immutable
        BEFORE UPDATE ON sales_invoices
        WHEN OLD.status != 'Draft'
          AND NOT (
            OLD.status = 'Submitted' AND NEW.status = 'Cancelled'
            AND NEW.company_id = OLD.company_id
            AND NEW.customer_id = OLD.customer_id
            AND NEW.invoice_number = OLD.invoice_number
            AND NEW.invoice_date = OLD.invoice_date
            AND NEW.due_date = OLD.due_date
            AND NEW.currency = OLD.currency
            AND NEW.subtotal_minor = OLD.subtotal_minor
            AND NEW.created_by IS OLD.created_by
            AND NEW.created_at = OLD.created_at
          )
        BEGIN
          SELECT RAISE(ABORT, 'submitted sales invoices are immutable');
        END;
      CREATE TRIGGER posted_sales_invoice_lines_no_update
        BEFORE UPDATE ON sales_invoice_lines
        WHEN EXISTS (
          SELECT 1 FROM sales_invoices
          WHERE id = OLD.invoice_id AND status != 'Draft'
        )
        BEGIN
          SELECT RAISE(ABORT, 'posted sales invoice lines are immutable');
        END;
    CREATE TRIGGER posted_sales_invoice_lines_no_insert
        BEFORE INSERT ON sales_invoice_lines
        WHEN EXISTS (
          SELECT 1 FROM sales_invoices
          WHERE id = NEW.invoice_id AND status != 'Draft'
        )
        BEGIN
          SELECT RAISE(ABORT, 'posted sales invoice lines are immutable');
        END;
      CREATE TRIGGER posted_sales_invoice_lines_no_delete
        BEFORE DELETE ON sales_invoice_lines
        WHEN EXISTS (
          SELECT 1 FROM sales_invoices
          WHERE id = OLD.invoice_id AND status != 'Draft'
        )
        BEGIN
          SELECT RAISE(ABORT, 'posted sales invoice lines are immutable');
        END;
      CREATE TRIGGER journal_accounts_must_be_active
        BEFORE INSERT ON journal_lines
        WHEN NOT EXISTS (
          SELECT 1 FROM accounts
          WHERE id = NEW.account_id
            AND company_id = NEW.company_id
            AND is_active = 1
            AND is_group = 0
        )
        BEGIN
          SELECT RAISE(ABORT, 'journal lines require an active ledger account');
        END;
  `,
  `
    DROP TRIGGER protected_accounts_no_deactivation;
    DROP TRIGGER ledger_accounts_with_activity_no_deactivation;
    DROP TRIGGER protected_accounts_no_rename;
    DROP TRIGGER accounts_active_parent_insert;
    DROP TRIGGER accounts_active_parent_update;
    DROP TRIGGER accounts_active_children_no_deactivation;
    DROP TRIGGER journal_accounts_must_be_active;
    DROP INDEX customers_company_active_idx;
    DROP TRIGGER submitted_sales_invoice_is_immutable;

    ALTER TABLE sales_invoices
        ADD COLUMN receivable_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT;
    UPDATE sales_invoices
       SET receivable_account_id = (
         SELECT id FROM accounts
         WHERE accounts.company_id = sales_invoices.company_id
           AND root_type = 'Asset'
           AND account_type = 'Receivable'
           AND is_group = 0
           AND is_active = 1
         ORDER BY id
         LIMIT 1
       )
     WHERE receivable_account_id IS NULL;

    ALTER TABLE accounts DROP COLUMN is_active;
    ALTER TABLE accounts DROP COLUMN is_protected;
    ALTER TABLE customers DROP COLUMN is_active;

    ALTER TABLE customers
        ADD COLUMN role TEXT NOT NULL DEFAULT 'Customer'
        CHECK (role IN ('Customer', 'Supplier', 'Both'));

    ALTER TABLE company_settings
        ADD COLUMN invoice_series_next INTEGER NOT NULL DEFAULT 1001
        CHECK (invoice_series_next > 0);

    CREATE TRIGGER sales_invoice_receivable_account_insert
        BEFORE INSERT ON sales_invoices
        WHEN NEW.receivable_account_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM accounts
          WHERE id = NEW.receivable_account_id
            AND company_id = NEW.company_id
            AND root_type = 'Asset'
            AND account_type = 'Receivable'
            AND is_group = 0
        )
        BEGIN
          SELECT RAISE(ABORT, 'sales invoice requires a receivable ledger account');
        END;
    CREATE TRIGGER sales_invoice_receivable_account_update
        BEFORE UPDATE OF receivable_account_id, company_id ON sales_invoices
        WHEN NEW.receivable_account_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM accounts
          WHERE id = NEW.receivable_account_id
            AND company_id = NEW.company_id
            AND root_type = 'Asset'
            AND account_type = 'Receivable'
            AND is_group = 0
        )
        BEGIN
          SELECT RAISE(ABORT, 'sales invoice requires a receivable ledger account');
        END;
    CREATE TRIGGER sales_invoice_receivable_account_immutable_after_submit
        BEFORE UPDATE OF receivable_account_id ON sales_invoices
        WHEN OLD.status != 'Draft' AND NEW.receivable_account_id != OLD.receivable_account_id
        BEGIN
          SELECT RAISE(ABORT, 'submitted invoice account is immutable');
        END;
    CREATE TRIGGER account_type_is_set_once
        BEFORE UPDATE OF account_type ON accounts
        WHEN OLD.account_type IS NOT NULL AND NEW.account_type IS NOT OLD.account_type
        BEGIN
          SELECT RAISE(ABORT, 'account type cannot be changed once assigned');
        END;
    CREATE TRIGGER journal_accounts_must_be_leaf
        BEFORE INSERT ON journal_lines
        WHEN NOT EXISTS (
          SELECT 1 FROM accounts
          WHERE id = NEW.account_id
            AND company_id = NEW.company_id
            AND is_group = 0
        )
        BEGIN
          SELECT RAISE(ABORT, 'journal lines require a ledger account');
        END;
    CREATE TRIGGER submitted_sales_invoice_is_immutable
        BEFORE UPDATE ON sales_invoices
        WHEN OLD.status != 'Draft'
          AND NOT (
            OLD.status = 'Submitted' AND NEW.status = 'Cancelled'
            AND NEW.company_id = OLD.company_id
            AND NEW.customer_id = OLD.customer_id
            AND NEW.invoice_number = OLD.invoice_number
            AND NEW.invoice_date = OLD.invoice_date
            AND NEW.due_date = OLD.due_date
            AND NEW.currency = OLD.currency
            AND NEW.subtotal_minor = OLD.subtotal_minor
            AND NEW.receivable_account_id = OLD.receivable_account_id
            AND NEW.created_by IS OLD.created_by
            AND NEW.created_at = OLD.created_at
          )
        BEGIN
          SELECT RAISE(ABORT, 'submitted sales invoices are immutable');
        END;
  `,
];

export function migrate(database: Database.Database): void {
  const currentVersion = database.pragma('user_version', { simple: true }) as number;

  if (currentVersion > migrations.length) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than this application supports`,
    );
  }

  for (let index = currentVersion; index < migrations.length; index += 1) {
    const applyMigration = database.transaction(() => {
      database.exec(migrations[index]);
      database.pragma(`user_version = ${index + 1}`);
    });
    applyMigration();
  }
}

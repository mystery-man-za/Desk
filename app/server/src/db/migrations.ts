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

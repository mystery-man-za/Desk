import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createInitialAdmin } from './auth/auth.service.js';
import { createApp } from './app.js';
import { openDatabase } from './db/database.js';
import { migrate } from './db/migrations.js';

const trustedOrigin = 'http://127.0.0.1:3001';

describe('HTTP application and site operating model', () => {
  const database = openDatabase(':memory:');
  const server = createServer(createApp(database, { serveFrontend: false }));
  let origin: string;
  let systemManagerCookie = '';
  let companyId: number;

  async function apiFetch(
    path: string,
    init: RequestInit = {},
    cookie = systemManagerCookie,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (cookie) headers.set('cookie', cookie);
    if (init.method && init.method !== 'GET') {
      headers.set('origin', trustedOrigin);
    }
    return fetch(`${origin}${path}`, { ...init, headers });
  }

  async function signIn(email: string, password: string): Promise<string> {
    const response = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: trustedOrigin,
      },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('books_session='));
    assert.ok(cookie);
    return cookie.split(';', 1)[0];
  }

  async function createCompanyRequest(
    name: string,
    bankAccountName = 'Main Bank',
    cookie = systemManagerCookie,
  ): Promise<Response> {
    return apiFetch(
      '/api/v1/companies',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          fullname: 'Alex Example',
          email: 'alex@example.test',
          country: 'South Africa',
          currency: 'zar',
          timeZone: 'Africa/Johannesburg',
          fiscalYearStart: '2026-03-01',
          fiscalYearEnd: '2027-02-28',
          chartId: 'starter',
          bankAccountName,
        }),
      },
      cookie,
    );
  }

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    origin = `http://127.0.0.1:${address.port}`;
    await createInitialAdmin(database, {
      email: 'admin@example.test',
      fullname: 'Site Administrator',
      password: 'a-secure-password',
    });
    systemManagerCookie = await signIn('admin@example.test', 'a-secure-password');
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    database.close();
  });

  it('keeps health and implemented setup choices public but requires login for site data', async () => {
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);

    const optionsResponse = await fetch(`${origin}/api/v1/setup/options`);
    assert.equal(optionsResponse.status, 200);
    const options = (await optionsResponse.json()) as {
      charts: Array<{ id: string }>;
      rootTypes: string[];
      accountTypes: string[];
    };
    assert.deepEqual(options.charts, [
      { id: 'starter', name: 'Starter chart of accounts' },
    ]);
    assert.ok(options.rootTypes.includes('Asset'));
    assert.ok(options.accountTypes.includes('Receivable'));

    const protectedResponse = await fetch(`${origin}/api/v1/companies`);
    assert.equal(protectedResponse.status, 401);
    assert.equal(
      ((await protectedResponse.json()) as { error: { code: string } }).error.code,
      'AUTHENTICATION_REQUIRED',
    );
  });

  it('rejects untrusted login origins and invalid credentials', async () => {
    const badOrigin = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.test' },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'a-secure-password',
      }),
    });
    assert.equal(badOrigin.status, 403);

    const badPassword = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: trustedOrigin },
      body: JSON.stringify({ email: 'admin@example.test', password: 'incorrect' }),
    });
    assert.equal(badPassword.status, 401);
    assert.equal(
      ((await badPassword.json()) as { error: { code: string } }).error.code,
      'INVALID_CREDENTIALS',
    );
  });

  it('allows initial administrator bootstrap exactly once', async () => {
    await assert.rejects(
      createInitialAdmin(database, {
        email: 'second-admin@example.test',
        fullname: 'Second Administrator',
        password: 'another-secure-password',
      }),
      /Users already exist/,
    );
    assert.equal(
      (
        database.prepare('SELECT COUNT(*) AS count FROM users').get() as {
          count: number;
        }
      ).count,
      1,
    );
  });

  it('returns the active user session and invalidates it on logout', async () => {
    const session = await apiFetch('/api/v1/auth/session');
    assert.equal(session.status, 200);
    assert.equal(
      ((await session.json()) as { user: { role: string } }).user.role,
      'System Manager',
    );

    const logout = await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    assert.equal(logout.status, 204);
    const invalidSession = await apiFetch('/api/v1/auth/session');
    assert.equal(invalidSession.status, 401);
    systemManagerCookie = await signIn('admin@example.test', 'a-secure-password');
  });

  it('creates a single configured company and its starter chart atomically', async () => {
    const response = await createCompanyRequest('Example Books');
    assert.equal(response.status, 201);
    const { company } = (await response.json()) as {
      company: { id: number; currency: string; setupComplete: boolean };
    };
    companyId = company.id;
    assert.equal(company.currency, 'ZAR');
    assert.equal(company.setupComplete, true);

    const accountResponse = await apiFetch(
      `/api/v1/companies/${companyId}/accounts`,
    );
    assert.equal(accountResponse.status, 200);
    const { accounts } = (await accountResponse.json()) as {
      accounts: Array<{ name: string; parentId: number | null }>;
    };
    assert.ok(accounts.some(({ name }) => name === 'Main Bank'));
    assert.ok(accounts.every(({ parentId }) => parentId === null || parentId > 0));
    const auditResponse = await apiFetch('/api/v1/audit-events');
    assert.equal(auditResponse.status, 200);
    const { events } = (await auditResponse.json()) as {
      events: Array<{ eventType: string; details: Record<string, unknown> }>;
    };
    const createdEvent = events.find(({ eventType }) => eventType === 'company.created');
    assert.equal(createdEvent?.details.currency, 'ZAR');

    const duplicate = await createCompanyRequest('Second Company');
    assert.equal(duplicate.status, 409);
    assert.equal(
      ((await duplicate.json()) as { error: { code: string } }).error.code,
      'COMPANY_ALREADY_CONFIGURED',
    );
  });

  it('rejects invalid setup input without persisting anything', async () => {
    const response = await apiFetch('/api/v1/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid',
        fullname: 'Alex',
        email: 'not-an-email',
        country: 'Nowhere',
        currency: 'US',
        timeZone: 'Not/AZone',
        fiscalYearStart: '2027-04-01',
        fiscalYearEnd: '2027-03-31',
        chartId: 'starter',
        bankAccountName: 'Invalid Bank',
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(
      ((await response.json()) as { error: { code: string } }).error.code,
      'VALIDATION_ERROR',
    );
    assert.equal(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM companies WHERE name = 'Invalid'")
          .get() as { count: number }
      ).count,
      0,
    );
  });

  it('rolls back company and account writes when chart setup fails', async () => {
    const before = database.prepare('SELECT COUNT(*) AS count FROM companies').get() as {
      count: number;
    };
    const accountsBefore = database
      .prepare('SELECT COUNT(*) AS count FROM accounts')
      .get() as { count: number };
    const response = await createCompanyRequest('Rollback Test', 'Assets');
    assert.equal(response.status, 409);
    const after = database.prepare('SELECT COUNT(*) AS count FROM companies').get() as {
      count: number;
    };
    const accountsAfter = database
      .prepare('SELECT COUNT(*) AS count FROM accounts')
      .get() as { count: number };
    assert.equal(after.count, before.count);
    assert.equal(accountsAfter.count, accountsBefore.count);
  });

  it('matches Books User read access while restricting account writes to managers', async () => {
    const createUserResponse = await apiFetch('/api/v1/auth/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'reader@example.test',
        fullname: 'Books Reader',
        password: 'another-secure-password',
        role: 'Books User',
      }),
    });
    assert.equal(createUserResponse.status, 201);
    const { user } = (await createUserResponse.json()) as {
      user: { id: number; email: string };
    };
    const readerCookie = await signIn(user.email, 'another-secure-password');

    const list = await apiFetch(
      `/api/v1/companies/${companyId}/accounts`,
      {},
      readerCookie,
    );
    assert.equal(list.status, 200);

    const create = await apiFetch(
      `/api/v1/companies/${companyId}/accounts`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Reader Created',
          rootType: 'Asset',
          isGroup: true,
        }),
      },
      readerCookie,
    );
    assert.equal(create.status, 403);
    assert.equal(
      ((await create.json()) as { error: { code: string } }).error.code,
      'PERMISSION_DENIED',
    );

    const noOrigin = await fetch(`${origin}/api/v1/companies/${companyId}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: readerCookie },
      body: JSON.stringify({
        name: 'Untrusted Origin',
        rootType: 'Asset',
        isGroup: true,
      }),
    });
    assert.equal(noOrigin.status, 403);

    const resetPassword = await apiFetch(
      `/api/v1/auth/users/${user.id}/password`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'reader-reset-password' }),
      },
    );
    assert.equal(resetPassword.status, 204);
    const revokedByPasswordReset = await apiFetch(
      '/api/v1/auth/session',
      {},
      readerCookie,
    );
    assert.equal(revokedByPasswordReset.status, 401);
    const oldPassword = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: trustedOrigin },
      body: JSON.stringify({
        email: user.email,
        password: 'another-secure-password',
      }),
    });
    assert.equal(oldPassword.status, 401);
    const newPasswordCookie = await signIn(user.email, 'reader-reset-password');

    const deactivate = await apiFetch(`/api/v1/auth/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(deactivate.status, 200);
    const revokedSession = await apiFetch(
      '/api/v1/auth/session',
      {},
      newPasswordCookie,
    );
    assert.equal(revokedSession.status, 401);
  });

  it('lets Books Managers write Books data but not manage site users', async () => {
    const response = await apiFetch('/api/v1/auth/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@example.test',
        fullname: 'Books Manager',
        password: 'manager-secure-password',
        role: 'Books Manager',
      }),
    });
    assert.equal(response.status, 201);
    const { user } = (await response.json()) as { user: { email: string } };
    const managerCookie = await signIn(user.email, 'manager-secure-password');

    const createAccount = await apiFetch(
      `/api/v1/companies/${companyId}/accounts`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Manager Created Group',
          rootType: 'Asset',
          isGroup: true,
        }),
      },
      managerCookie,
    );
    assert.equal(createAccount.status, 201);

    const listUsers = await apiFetch(
      '/api/v1/auth/users',
      {},
      managerCookie,
    );
    assert.equal(listUsers.status, 403);
    const audit = await apiFetch('/api/v1/audit-events', {}, managerCookie);
    assert.equal(audit.status, 200);
  });

  it('never permits deactivation or demotion of the last System Manager', async () => {
    const response = await apiFetch('/api/v1/auth/users/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'Books Manager' }),
    });

    assert.equal(response.status, 409);
    assert.equal(
      ((await response.json()) as { error: { code: string } }).error.code,
      'LAST_SYSTEM_MANAGER',
    );
  });

  it('protects audit history from edits and deletions', () => {
    assert.throws(
      () =>
        database
          .prepare('UPDATE audit_events SET event_type = ? WHERE id = 1')
          .run('changed'),
      /audit events are append-only/,
    );
    assert.throws(
      () => database.prepare('DELETE FROM audit_events WHERE id = 1').run(),
      /audit events are append-only/,
    );
  });

  it('enforces account tree invariants in SQLite as well as in the service', () => {
    const parent = database
      .prepare(
        "SELECT id FROM accounts WHERE company_id = ? AND name = 'Current Assets'",
      )
      .get(companyId) as { id: number };
    const ledger = database
      .prepare("SELECT id FROM accounts WHERE company_id = ? AND name = 'Cash'")
      .get(companyId) as { id: number };
    assert.throws(
      () =>
        database
          .prepare(
            `INSERT INTO accounts
             (company_id, name, root_type, account_type, parent_id, is_group)
             VALUES (?, 'Direct SQL Child', 'Asset', 'Cash', ?, 0)`,
          )
          .run(companyId, ledger.id),
      /account parent must be a group/,
    );
    assert.throws(
      () =>
        database
          .prepare(
            `INSERT INTO accounts
             (company_id, name, root_type, parent_id, is_group)
             VALUES (?, 'Untyped Bank Child', 'Asset', ?, 0)`,
          )
          .run(
            companyId,
            (
              database
                .prepare("SELECT id FROM accounts WHERE company_id = ? AND name = 'Bank Accounts'")
                .get(companyId) as { id: number }
            ).id,
          ),
      /account type must inherit from its parent/,
    );
    assert.throws(
      () =>
        database.prepare('UPDATE accounts SET is_group = 0 WHERE id = ?').run(parent.id),
      /account with children must remain a group/,
    );
  });

  it('enforces account group-parent and inherited root-type rules for a manager', async () => {
    const accountsResponse = await apiFetch(
      `/api/v1/companies/${companyId}/accounts`,
    );
    const { accounts } = (await accountsResponse.json()) as {
      accounts: Array<{ id: number; name: string; isGroup: boolean }>;
    };
    const parent = accounts.find(({ name }) => name === 'Current Assets');
    const ledger = accounts.find(({ name }) => name === 'Cash');
    assert.ok(parent?.isGroup);
    assert.ok(ledger && !ledger.isGroup);

    const validChild = await apiFetch(
      `/api/v1/companies/${companyId}/accounts`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Petty Cash',
          parentId: parent.id,
          isGroup: false,
        }),
      },
    );
    assert.equal(validChild.status, 201);
    const { account } = (await validChild.json()) as {
      account: { rootType: string; accountType: string | null };
    };
    assert.equal(account.rootType, 'Asset');
    assert.equal(account.accountType, null);

    const invalidChild = await apiFetch(
      `/api/v1/companies/${companyId}/accounts`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Child',
          parentId: ledger.id,
          isGroup: false,
        }),
      },
    );
    assert.equal(invalidChild.status, 400);
    assert.equal(
      ((await invalidChild.json()) as { error: { code: string } }).error.code,
      'PARENT_ACCOUNT_NOT_GROUP',
    );
  });

  it('validates JSON parser errors with structured client responses', async () => {
    const response = await apiFetch('/api/v1/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must contain valid JSON.',
      },
    });
  });

  it('does not serve the frontend from the API server in development', async () => {
    const response = await fetch(`${origin}/dashboard`);
    assert.equal(response.status, 404);
  });
});

describe('database migrations', () => {
  it('upgrades the original companies table without losing existing data', () => {
    const database = new Database(':memory:');
    database.exec(`
      CREATE TABLE companies (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    database.prepare('INSERT INTO companies (name) VALUES (?)').run('Example Co');
    migrate(database);
    assert.equal(database.pragma('user_version', { simple: true }), 6);
    assert.equal(
      (database.prepare('SELECT name FROM companies').get() as { name: string }).name,
      'Example Co',
    );
    assert.deepEqual(
      database.prepare('PRAGMA table_info(companies)').all().map((column) => column.name),
      ['id', 'name', 'created_at'],
    );
    database.close();
  });

  it('creates scoped account and user session schemas', () => {
    const database = openDatabase(':memory:');
    assert.equal(database.pragma('user_version', { simple: true }), 6);
    for (const table of [
      'company_settings',
      'accounts',
      'users',
      'sessions',
      'audit_events',
    ]) {
      assert.equal(
        (
          database
            .prepare('SELECT COUNT(*) AS count FROM sqlite_master WHERE name = ?')
            .get(table) as { count: number }
        ).count,
        1,
      );
    }
    database.close();
  });
});

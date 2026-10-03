# Backend porting map

This document maps the existing Frappe Books backend concepts to the new
Node.js/SQLite application. It is a behavior map, not a line-by-line port.
Frappe source and its data are licensed under AGPL-3.0-only; any future reuse
of source code or bundled data must be reviewed for the applicable license and
notices. The starter chart in this app is independently authored and
intentionally incomplete.

## Existing backend structure

The Frappe app's Python package is
[`frappe_books/`](../../frappe-books/frappe_books/frappe_books/).

| Frappe Books area | Responsibility |
| --- | --- |
| [`doctype/books_setup_wizard/`](../../frappe-books/frappe_books/frappe_books/doctype/books_setup_wizard/) | Setup fields, country-derived suggestions, time-zone normalization, fiscal-year validation, and setup completion entry point. |
| [`setup_service.py`](../../frappe-books/frappe_books/setup_service.py) | Setup orchestration: site/company settings, chart installation, regional records, cash/bank accounts, accounting/inventory/POS defaults, payment methods, and number series. |
| [`coa.py`](../../frappe-books/frappe_books/coa.py) | Loads standard and country charts, flattens a chart tree, creates groups and ledgers, and chooses suitable defaults. |
| [`doctype/books_account/`](../../frappe-books/frappe_books/frappe_books/doctype/books_account/) | Account invariants and nested-set tree behavior: roots are groups, children require group parents, and child root types come from their parent. |
| Frappe site Users and DocType permission declarations | Multiple users belong to a site. System Manager and Books Manager generally have write permissions; Books User is generally read-focused but may create customers and submit sales invoices. Frappe handles login, sessions, roles, and user administration at the site/framework level. |
| [`accounting/`](../../frappe-books/frappe_books/frappe_books/accounting/) | Accounting calculations and ledger behavior. This is the next critical domain area after setup/COA. |
| [`reports/`](../../frappe-books/frappe_books/frappe_books/reports/) | Report aggregation and financial statement behavior. Reports must follow the ported ledger rules rather than duplicate balances in frontend code. |

The setup wizard contains the user-facing setup inputs. `setup_service.run_setup`
is the important orchestration boundary: successful setup affects more than a
company record, including defaults used by payment, inventory, POS, regional
taxes, and document numbering. Those side effects are not all implemented in
the new app yet.

## New application boundaries

| New backend module | Current role |
| --- | --- |
| `server/src/app.ts` | Composes middleware and versioned routes; does not open the database or start a listener. |
| `server/src/config/env.ts` | Parses runtime configuration. |
| `server/src/db/database.ts` and `migrations.ts` | Opens SQLite with restrictive local file permissions, configures constraints, and upgrades the schema transactionally. |
| `server/src/features/companies/` | Validates setup input and creates/query company profile and setup settings. |
| `server/src/features/accounts/` | Owns account types, the starter chart, company-scoped account queries, and parent/root invariants. |
| `server/src/features/setup/` | Exposes setup choices supported by this app. |
| `server/src/auth/` | Opaque hashed sessions, scrypt password verification, user provisioning, and Frappe Books role checks. |
| `server/src/audit/` and `features/audit/` | Append-only audit event recording and role-controlled paged reads. |
| `server/src/errors/` and `middleware/` | Converts expected domain/API errors and unexpected failures into consistent HTTP responses. |

The API keeps feature behavior in services and request/response handling in
routes. SQLite constraints backstop service validation; setup's company,
settings, and initial chart inserts share a single transaction.
Like a Frappe site, the current design has one Books company and multiple site
users. It is not multi-tenant SaaS. User signup is disabled: initial
site-owner creation is an explicit one-time first-run action in the browser or
CLI. That owner is a regular named user with the System Manager role. This
implementation does not create Frappe's special `Administrator` identity or
its all-permissions bypass. Setup state belongs to the database/site; another
app instance using the same database sees the same users and company. New
users are provisioned by a System Manager and do not repeat company setup.

## Implemented first slice

- `GET /api/v1/setup/options` returns the single built-in starter chart and
  supported account/root types.
- `POST /api/v1/companies` validates required profile/contact, country,
  three-letter currency, IANA time zone, fiscal dates, chart, and bank account
  fields. On success it creates a company, setup settings, and starter chart
  atomically.
- `GET /api/v1/companies` lists companies and setup status.
- `GET /api/v1/companies/:companyId` reads saved setup details.
- `GET /api/v1/companies/:companyId/accounts` returns the company's accounts.
- `POST /api/v1/companies/:companyId/accounts` creates a group or ledger under
  a valid parent, with root type inherited from that parent.
- `PATCH /api/v1/companies/:companyId/accounts/:accountId` edits account
  names and one-time account types. The chart tree shape and account type are
  treated as Frappe Books configuration rather than adding active/protected
  account states. The account `code` field remains a documented app-specific
  extension; Frappe Books accounts do not have account codes.
- `/api/v1/companies/:companyId/sales/*` supports customers, draft sales
  invoices, ledger submission, and cancellation by reversal. Posting debits
  the invoice-selected Accounts Receivable account and credits income accounts
  using currency-specific integer minor units. Invoice numbers use a
  transactionally allocated `SINV-1001` series. Cancellation creates an
  immutable reversing entry dated on the invoice date, matching Books'
  voucher-date behavior. The older SQLite schema's constrained `due_date`
  column is retained internally for safe upgrades and mirrors the invoice date;
  it is not part of the API or user workflow.
- `/api/v1/auth/*` provides login/logout/session/password operations using
  opaque database-backed sessions; password hashes use Node scrypt.
- First-run browser bootstrap accepts owner credentials only while the site
  has no users, creates a System Manager once, and establishes the session.
  It does not create Frappe's special Administrator or default credentials.
- The Manage users screen lets System Managers create users, assign roles,
  disable/reactivate access, and reset passwords; new users never repeat site
  company setup.
- An authenticated Books User can read setup/company/account data, create
  customers, and draft/post sales invoices; account changes and invoice
  cancellation require a Books Manager or System Manager.
- User, company, and account changes append immutable audit events as part of
  the corresponding SQLite transaction.
- Sign-in uses a rate-limited, opaque server-side session, and password
  changes/reset revoke existing sessions.
- The SQLite database enforces one company per site. The migration preserves
  existing company data and refuses an ambiguous multi-company upgrade.
- Session-cookie writes enforce trusted browser origins; sign-in is rate
  limited; database file permissions are restricted on Unix-like systems.

The first sales slice is intentionally limited: the UI creates one freeform
service line and a simple Customer party; it does not yet implement item-backed
invoice rows, taxes, discounts, receipts, or inventory. Currency precision is
derived from the currency's CLDR data, but monetary calculations currently
support only this simple positive-amount case. It is a tested accounting
foundation rather than parity with all Frappe Books behavior.

Frappe's implementation offers broader regional chart selection and setup
defaults. The new implementation currently accepts country names as supplied, checks
currency shape rather than looking it up in a supported-currency catalog, and
only offers its small starter chart. Role checks cover the currently exposed
setup and account endpoints; as additional endpoints are added, each must
declare and test its permission policy. These are explicit gaps, not claims of
full parity.

## Accounting implementation order

1. Finish setup parity intentionally: decide country/currency catalogs and
   defaults, regional settings, company branding, and which Frappe defaults
   have equivalent meaning in this app.
2. Expand/import supported account charts with license review; implement
   Frappe-aligned account deletion rules, plus any explicitly app-specific
   account-code behavior.
3. Extend ledger posting with full decimal arithmetic, balancing,
   date/period locks, payment allocation, and atomic writes.
   Money should use integer minor units or a decimal representation, never
   JavaScript binary floating-point arithmetic.
4. Build invoice/payment and inventory workflows against ledger services.
5. Add reports as ledger-derived queries and compare totals against the
   existing app's test cases.

The authentication and partial audit foundations do not make this a
production accounting service. Audit coverage must expand with every new
mutation; it still needs ledger invariants, account maintenance and
default-setting parity, recovery/backup procedures, and independent security
and accounting review before real financial data or untrusted network access.

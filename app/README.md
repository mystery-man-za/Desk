# Books web app

An independent web application built with React, Vite, Node.js, Express, and
SQLite. It is separate from the existing Frappe/Python/Vue application and is
organized to grow by feature as accounting capabilities are implemented.

## Requirements

- Node.js 20 or newer
- npm

## Run in development

From this directory:

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:3001>. Vite serves the React development app on port
`3001` and proxies `/api` requests to the Node API on port `3002`. The backend
only serves API requests in development; it does not serve a stale production
build on a second port. Check the API directly at
<http://127.0.0.1:3002/api/health>, or through Vite's proxy at
<http://127.0.0.1:3001/api/health>.

The backend initializes `server/data/books.sqlite` and applies versioned
database migrations on first start. The database file is local and git-ignored.
Set `DATABASE_PATH` to use a different SQLite file. Set `HOST` and `PORT` to
change the API listener (defaults to `127.0.0.1:3002`). Set `API_PORT` to
change the backend port and the Vite proxy target together; use `PORT` to
override the backend listener directly, or `FRONTEND_PORT` to change Vite's
port. `APP_ORIGINS` is a comma-separated trusted-origin allowlist for browser
requests; development defaults to localhost ports. Production deployments
behind an HTTPS reverse proxy must set `APP_ORIGINS` to the external HTTPS
origin. The app does not trust forwarded proxy headers by default. If there is
a trusted reverse proxy, set `TRUST_PROXY` to its exact hop count (usually `1`)
and configure the proxy to replace, not pass through, client-supplied forwarded
headers.

## Site users and roles

The operating model matches a Frappe Books site: one configured Books company
per database/site, with multiple users and role-based access. It is not a
multi-tenant hosted service. Users sign in with an opaque, server-side session
stored as a hash in SQLite and an HTTP-only, SameSite cookie. Sessions expire
after 14 days, logout/password changes revoke them, and sign-in attempts are
rate-limited.

The role mapping follows the Books DocType permissions in the current source:

- **System Manager** can administer users and make Books changes.
- **Books Manager** can make Books changes but cannot administer site users.
- **Books User** is generally read-focused; Books users can create customers
  and draft/post sales invoices, but cannot change the chart or cancel posted
  invoices.

On a new site, open the app and choose **Create the site owner account**. Enter
your own name, sign-in email, and password; successful setup signs you in and
continues to the one-time Books company setup wizard. The owner is a named
**System Manager** user, not Frappe's special `Administrator` account or an
unrestricted hidden login. There are no default credentials. Bootstrap is
available only while the database has no users, requires a trusted browser
origin, is rate-limited, and can succeed only once.

For unattended initial setup, an operator can bootstrap the first
System Manager using environment-provided values rather than placing a password
in shell history:

```sh
read -r ADMIN_EMAIL
read -r ADMIN_NAME
read -s ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
npm run bootstrap:admin
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
```

The password must be at least 12 characters. Initial bootstrap fails once any
user exists; there is no public sign-up endpoint after first-run setup. A
System Manager provisions additional users from **Manage users** in the app.
They choose whether each person is a System Manager, Books Manager, or Books
User. New users do not repeat company setup: the company and accounting
configuration are shared by everyone using the same database. User passwords
are set by the System Manager and must be handed to each user securely; this
app does not send invitation email.
System Managers can reset another user's password through
`PUT /api/v1/auth/users/:userId/password`; the user should receive the new
password out of band. Users can change their own password through
`POST /api/v1/auth/password`. Either operation revokes the affected user's
active sessions.

Company setup, account creation, and user administration append audit events
inside the same transaction as the change. Audit records cannot be updated or
deleted through SQLite. System Managers and Books Managers can page through
`GET /api/v1/audit-events?limit=50`; details exclude credentials and password
hashes.

The Sales workspace currently supports customer creation, one-line draft
invoices, posting to the general ledger, and cancellation through an immutable
reversing journal entry. Posted invoices debit the active Accounts Receivable
ledger and credit the selected income account. Amounts are stored as integer
minor currency units and quantities as thousandths; this initial slice assumes
two decimal currency places and does not yet support tax, discounts, payments,
inventory, or multiple editable invoice lines in the UI. The API validates
balanced postings transactionally; the ledger and posted journal entries
cannot be edited or deleted.

The SQLite file is stored under a private directory and created with restrictive
permissions on Unix-like systems. Keep it and its backups private. SQLite is
not encrypted at rest by this application.

## Project structure

```text
app/
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── app/                 # Router and application composition
│       ├── components/          # Shared layout and system components
│       ├── features/            # Dashboard and feature pages
│       ├── shared/              # API client and shared infrastructure
│       └── styles/              # Global app styles
└── server/
    └── src/
        ├── auth/                 # Sessions, passwords, and role policies
        ├── audit/                # Append-only audit event persistence
        ├── cli/                  # First-site owner bootstrap
        ├── app.ts                # Express app composition
        ├── config/               # Runtime configuration
        ├── db/                   # SQLite connection and migrations
        ├── errors/               # Structured API errors
        ├── features/
        │   ├── accounts/         # Account types and starter chart
        │   ├── companies/        # Company setup, validation, and queries
        │   ├── sales/            # Customers, invoices, and journal posting
        │   ├── health/
        │   └── setup/            # Setup wizard option catalogs
        ├── middleware/           # Cross-cutting HTTP middleware
        └── index.ts              # Process startup and shutdown
```

Each feature owns its UI or API routes; shared layout, HTTP plumbing, and
database infrastructure stay outside feature modules. Keep business rules out
of route handlers as domain logic is introduced. Add schema changes as new
ordered migrations rather than editing the initial migration.

### Frontend component structure

The React UI follows Frappe Books' component boundaries while keeping its own
implementation and conventions:

- `components/layout/` contains the app shell, route-aware `Sidebar`, shared
  `PageHeader`, feature `PageTitle`/`PageContainer`, and responsive
  `MobileNavigation`. Sidebar and mobile menu items are defined once in
  `navigation.ts`; available routes are grouped in the same way as Books'
  desktop sidebar and mobile navigation sheet.
- `components/ui/` contains reusable app icons, buttons, status badges, empty
  states, and `AppSheet`. The sheet uses dialog semantics on desktop and a
  bottom-sheet presentation on small screens, with dismissal, focus handling,
  and reduced-motion support.
- `features/` owns page content and feature-specific interaction. Pages use
  the shared layout and UI primitives rather than implementing their own
  navigation, dialogs, or page-heading patterns.
- `styles/global.css` holds shared visual tokens and responsive patterns.
  Tailwind CSS 4 is configured with Frappe UI semantic color, typography,
  spacing, and radius conventions. Frappe Books uses Tailwind through its
  `frappe-ui` preset; `@fontsource-variable/inter` supplies the same Inter
  Variable family here. The React app adapts those design tokens without
  importing Vue UI components.
  Backend-dependent Books components such as searchable document lists,
  report tables, filters, and pagination should be added with the corresponding
  data workflows rather than shipping nonfunctional controls.

This is a React adaptation of Books' component architecture, not a direct
port of its Vue components or an assertion of feature parity.

## Backend porting status

The backend has authenticated site sessions, role-checked user administration,
company setup, and chart-of-accounts foundations. Sign in at
`POST /api/v1/auth/login`; inspect the current session at
`GET /api/v1/auth/session`; sign out at `POST /api/v1/auth/logout`. Mutating
browser requests require a trusted `Origin`. `GET /api/v1/setup/options`
advertises the built-in chart and account types. An authenticated manager can
create the site's single company with `POST /api/v1/companies`; settings and the
starter hierarchy are committed together. Company details and accounts are
available at `GET /api/v1/companies/:companyId` and
`GET /api/v1/companies/:companyId/accounts`. `POST
/api/v1/companies/:companyId/accounts` enforces manager access, group-parent,
and inherited-root-type rules. System Managers manage users at
`/api/v1/auth/users`. API errors use a stable
`{ error: { code, message, details? } }` shape.

The React app provides a first-use flow: create the site owner's System
Manager account, automatically sign in, create the site's company once, review
the generated chart of accounts, then continue to the dashboard. The company
contact name and email entered during company setup are business details, not
login credentials. System Managers can explicitly provision other site users
from the Manage users screen. Reusing the same database shares its users,
company, and setup state; only an empty database needs owner bootstrap.

The starter chart is deliberately a small, independently authored foundation;
it is **not** the Frappe standard or regional chart and is not ready for real
bookkeeping. This backend does not yet implement country/currency catalogs,
regional setup, editing/deleting accounts, journal entries, ledger posting,
financial reports, backups, or complete audit history. Do not use it for real
accounting until those accounting features, operational recovery, and
independent review are complete. Keep deployment behind HTTPS and do not expose
the API directly to untrusted networks.

After bootstrapping the administrator and signing in to save a session cookie,
create the site's company:

```sh
curl -b books.cookies -c books.cookies \
  -X POST http://127.0.0.1:3002/api/v1/companies \
  -H 'Origin: http://127.0.0.1:3001' \
  -H 'content-type: application/json' \
  -d '{
    "name": "Example Company",
    "fullname": "Alex Example",
    "email": "alex@example.com",
    "country": "South Africa",
    "currency": "ZAR",
    "timeZone": "Africa/Johannesburg",
    "fiscalYearStart": "2026-03-01",
    "fiscalYearEnd": "2027-02-28",
    "chartId": "starter",
    "bankAccountName": "Main Bank"
  }'
```

See [`docs/backend-porting-map.md`](docs/backend-porting-map.md) for the legacy
backend structure and the planned translation into this stack.

## Build, test, and run

```sh
npm run typecheck
npm test
npm run build
npm start
```

The build emits the frontend to `client/dist` and the API to `server/dist`.
After building, `npm start` serves both the web app and API on port `3001` by
default. In production they intentionally share one server and port: the API
handles `/api`, and Express serves the built React app for client-side routes.
Set `PORT` to change the production listener. Unknown `/api` endpoints return
JSON 404 responses.

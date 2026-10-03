# Desk — Frappe Books web app

This project runs the Frappe Books accounting app as a website on the Frappe
Framework. The frontend is Vue 3 and Vite; Python/Frappe provides the site,
login, permissions, database, and server-side APIs.

## What is in this repository

- [`frappe-books/`](frappe-books/) — the Books app source, including the Vue
  frontend and Python app.
- [`app/`](app/) — an independent Node.js, React/Vite, and SQLite web app
  starter for a new Books implementation.
- [`books-bench/`](books-bench/) — this project's bench configuration and
  development `Procfile`.
- `books-bench/apps/frappe_books` — a relative link to `../../frappe-books`.
- `books-bench/apps/frappe` — a Git link pinned to Frappe Framework commit
  `9d3f2b9eeb123dd63b4be44bbac23b3a5274b3ea` (the Frappe 17 development
  branch).

The Books app source is included in a normal clone. Git does not automatically
fetch the Frappe Framework Git link because this repository has no
`.gitmodules` file; fetch that exact checkout as described below.

The bench directory is not a portable database backup or a complete production
deployment. Site data lives in PostgreSQL, and each developer needs a local
Python environment and supporting services.

## Requirements

- Python 3.14 or newer (required by `frappe-books/pyproject.toml`)
- Node.js and Yarn, using versions supported by Frappe Framework 17
- PostgreSQL
- Redis
- Frappe Bench

Install the operating-system packages and services using the Frappe Framework
installation guide for your OS before setting up this project.

## Fresh clone setup

Run these commands from the directory where you want the project:

```sh
git clone https://github.com/mystery-man-za/Desk.git
cd Desk

# Fetch the pinned Frappe Framework checkout (the parent repo stores only a Git link).
git clone https://github.com/frappe/frappe.git books-bench/apps/frappe
git -C books-bench/apps/frappe checkout 9d3f2b9eeb123dd63b4be44bbac23b3a5274b3ea

# Create the Python environment and install the Bench CLI into it.
python3.14 -m venv books-bench/env
books-bench/env/bin/pip install frappe-bench

# Install this bench's app dependencies and build the Books frontend.
cd books-bench
./env/bin/bench setup requirements
./env/bin/bench build --app frappe_books
```

Start PostgreSQL and Redis. Then create a **new local site** (the tracked
`books.localhost` files are configuration only; the database itself is not
included):

```sh
./env/bin/bench new-site books-dev.localhost --db-type postgres
./env/bin/bench --site books-dev.localhost install-app frappe_books
./env/bin/bench use books-dev.localhost
```

Bench prompts for the database and Administrator passwords. Start the full
development stack from `books-bench/`:

```sh
./env/bin/bench start
```

Open [http://localhost:8000/books](http://localhost:8000/books) and sign in as
the Administrator (or another permitted user). An unauthenticated visit to
`/books` redirects to the Frappe login page.

## Run the existing local site

If this machine already has the `books.localhost` database configured, open a
terminal in `books-bench/` and run:

```sh
bench --site books.localhost list-apps
bench start
```

Confirm that `frappe_books` appears in the app list. Keep the terminal running
while using the site; stop the stack with `Ctrl+C`. In VS Code, `bench start`
can also be run as a background task.

## Frontend and backend

The Vue/Vite frontend is under `frappe-books/frontend/`; its production assets
are built into `frappe-books/frappe_books/public/books/` and served by Frappe.
The Books app's browser routes, including `/books`, are registered in the Frappe
app. Its frontend calls Frappe APIs using the current site's session and CSRF
token. The Python app and Frappe Framework are therefore required to run the
complete application; this is not a standalone static frontend.

## Independent web app starter

The [`app/`](app/) directory is a separate Node.js backend and React/Vite
frontend backed by SQLite. It does not replace or depend on the Frappe app.
See [`app/README.md`](app/README.md) for setup and development commands.

The root `frappe-books/package.json` defines the app's frontend build scripts.
The frontend package also defines `test`, `typecheck`, `lint`, and `build`
scripts in `frappe-books/frontend/package.json`.

## Site data and credentials

This repository does not include a PostgreSQL database dump, so cloning it does
not restore existing companies, transactions, or users. Create a new site as
above or restore a separately secured database backup.

Review `books-bench/sites/*/site_config.json` and
`books-bench/sites/common_site_config.json` before sharing or publishing. Site
configuration can contain credentials and encryption keys; never commit real
production secrets. If credentials have already been published, rotate them.

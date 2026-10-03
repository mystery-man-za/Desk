import Database from 'better-sqlite3';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config/env.js';
import { migrate } from './migrations.js';

export function openDatabase(filename = config.databasePath): Database.Database {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  }

  const database = new Database(filename);
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  if (filename !== ':memory:') {
    database.pragma('journal_mode = WAL');
    chmodSync(filename, 0o600);
  }

  try {
    migrate(database);
    return database;
  } catch (error) {
    database.close();
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.includes('companies_single_site_company_idx')
    ) {
      throw new Error(
        'This database contains more than one company, but this Books site supports one company. Resolve the duplicate company records before upgrading.',
        { cause: error },
      );
    }
    throw error;
  }
}

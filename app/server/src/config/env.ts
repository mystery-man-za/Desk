import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDatabasePath = fileURLToPath(
  new URL('../../data/books.sqlite', import.meta.url),
);

function readPort(value: string | undefined, defaultPort: number): number {
  if (value === undefined) return defaultPort;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function readAppOrigins(): string[] {
  const defaults =
    process.env.NODE_ENV === 'production'
      ? ''
      : 'http://127.0.0.1:3001,http://localhost:3001';

  return (process.env.APP_ORIGINS ?? defaults)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`Invalid APP_ORIGINS value: ${origin}`);
      }
      if (
        parsed.origin !== origin ||
        (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:')
      ) {
        throw new Error(
          `APP_ORIGINS entries must be origins${process.env.NODE_ENV === 'production' ? ' using HTTPS' : ''}.`,
        );
      }
      return parsed.origin;
    });
}

function readProxyHops(): number {
  const value = process.env.TRUST_PROXY;
  if (value === undefined) return 0;

  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
    throw new Error('TRUST_PROXY must be a hop count between 1 and 10');
  }
  return hops;
}

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: readPort(
    process.env.PORT ?? process.env.API_PORT,
    process.env.NODE_ENV === 'production' ? 3001 : 3002,
  ),
  databasePath: resolve(process.env.DATABASE_PATH ?? defaultDatabasePath),
  isProduction: process.env.NODE_ENV === 'production',
  appOrigins: readAppOrigins(),
  trustProxyHops: readProxyHops(),
  sessionDurationHours: 24 * 14,
};

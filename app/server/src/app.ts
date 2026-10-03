import express from 'express';
import type Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { createAccountsRouter } from './features/accounts/accounts.routes.js';
import { createCompaniesRouter } from './features/companies/companies.routes.js';
import { createHealthRouter } from './features/health/health.routes.js';
import { createSetupRouter } from './features/setup/setup.routes.js';
import { createAuditRouter } from './features/audit/audit.routes.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { requireAuthentication } from './auth/auth.middleware.js';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';

const frontendDirectory = fileURLToPath(
  new URL('../../client/dist/', import.meta.url),
);
const frontendEntry = fileURLToPath(
  new URL('../../client/dist/index.html', import.meta.url),
);

type AppOptions = {
  serveFrontend?: boolean;
};

export function createApp(
  database: Database.Database,
  { serveFrontend = true }: AppOptions = {},
) {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxyHops > 0) {
    app.set('trust proxy', config.trustProxyHops);
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/health', createHealthRouter(database));
  app.use('/api/v1/setup', createSetupRouter());
  app.use('/api/v1/auth', createAuthRouter(database));
  app.use('/api/v1', requireAuthentication(database));
  app.use('/api/v1/audit-events', createAuditRouter(database));
  app.use('/api/v1/companies', createCompaniesRouter(database));
  app.use(
    '/api/v1/companies/:companyId/accounts',
    createAccountsRouter(database),
  );
  app.use('/api', (_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'API endpoint not found.' },
    });
  });

  if (serveFrontend) {
    app.use(express.static(frontendDirectory));
    app.get('/{*path}', (_request, response, next) => {
      response.sendFile(frontendEntry, (error) => {
        if (error) next(error);
      });
    });
  } else {
    app.use((_request, response) => {
      response.status(404).json({
        error: { code: 'NOT_FOUND', message: 'API endpoint not found.' },
      });
    });
  }

  app.use(errorHandler);
  return app;
}

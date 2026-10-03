import { Router } from 'express';
import { ACCOUNT_TYPES, ROOT_TYPES } from '../accounts/types.js';
import { STARTER_CHART_ID } from '../accounts/starter-chart.js';

export function createSetupRouter(): Router {
  const router = Router();

  router.get('/options', (_request, response) => {
    response.json({
      charts: [{ id: STARTER_CHART_ID, name: 'Starter chart of accounts' }],
      rootTypes: ROOT_TYPES,
      accountTypes: ACCOUNT_TYPES,
    });
  });

  return router;
}

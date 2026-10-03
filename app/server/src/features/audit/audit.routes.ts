import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { requireRoles } from '../../auth/auth.middleware.js';
import { ApiError } from '../../errors/api-error.js';

const querySchema = z.object({
  beforeId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function createAuditRouter(database: Database.Database): Router {
  const router = Router();

  router.get(
    '/',
    requireRoles('System Manager', 'Books Manager'),
    (request, response) => {
      const query = querySchema.safeParse(request.query);
      if (!query.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Audit event query is invalid.',
        );
      }

      const rows = database
        .prepare(
          `SELECT a.id, a.actor_user_id, u.email AS actor_email, a.event_type,
                  a.entity_type, a.entity_id, a.details, a.created_at
           FROM audit_events a
           LEFT JOIN users u ON u.id = a.actor_user_id
           WHERE (? IS NULL OR a.id < ?)
           ORDER BY a.id DESC
           LIMIT ?`,
        )
        .all(
          query.data.beforeId ?? null,
          query.data.beforeId ?? null,
          query.data.limit,
        ) as Array<{
        id: number;
        actor_user_id: number | null;
        actor_email: string | null;
        event_type: string;
        entity_type: string;
        entity_id: string;
        details: string;
        created_at: string;
      }>;

      response.json({
        events: rows.map((row) => ({
          id: row.id,
          actor: row.actor_user_id
            ? { id: row.actor_user_id, email: row.actor_email }
            : null,
          eventType: row.event_type,
          entityType: row.entity_type,
          entityId: row.entity_id,
          details: JSON.parse(row.details) as Record<string, unknown>,
          createdAt: row.created_at,
        })),
        nextBeforeId: rows.length === query.data.limit ? rows.at(-1)?.id : null,
      });
    },
  );

  return router;
}

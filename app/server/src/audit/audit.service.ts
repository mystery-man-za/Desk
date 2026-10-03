import type Database from 'better-sqlite3';

export type AuditEvent = {
  actorUserId: number | null;
  eventType: string;
  entityType: string;
  entityId: number | string;
  details?: Record<string, string | number | boolean | null>;
};

export function recordAuditEvent(
  database: Database.Database,
  event: AuditEvent,
): void {
  database
    .prepare(
      `INSERT INTO audit_events (
         actor_user_id, event_type, entity_type, entity_id, details
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      event.actorUserId,
      event.eventType,
      event.entityType,
      String(event.entityId),
      JSON.stringify(event.details ?? {}),
    );
}

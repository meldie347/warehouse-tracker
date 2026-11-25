/**
 * How long AuditLog rows are kept before the nightly cron
 * (src/app/api/cron/cleanup/route.ts) deletes them. The Activity Log and the
 * shop report can never show data older than this — kept in one place so the
 * cron and every page that surfaces a "may be incomplete" note stay in sync.
 */
export const AUDIT_LOG_RETENTION_DAYS = 30;

/** The oldest an AuditLog row can be right now before it's purged. */
export function getAuditLogRetentionCutoff(): Date {
  return new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

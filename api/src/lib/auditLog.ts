import { query } from "../db.js";

export type AuditResult = "success" | "warning" | "error";
export type AuditLevel = "info" | "warn" | "error" | "success";

export interface AuditLogInput {
  stage: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  action?: string;
  statusBefore?: string;
  statusAfter?: string;
  result?: AuditResult;
  jobId?: string;
  message: string;
  level: AuditLevel;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await query(
    `
      insert into pipeline_logs (
        stage,
        entity_type,
        entity_id,
        actor,
        action,
        status_before,
        status_after,
        result,
        job_id,
        message,
        level,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `,
    [
      input.stage,
      input.entityType ?? null,
      input.entityId ?? null,
      input.actor ?? null,
      input.action ?? null,
      input.statusBefore ?? null,
      input.statusAfter ?? null,
      input.result ?? null,
      input.jobId ?? null,
      input.message,
      input.level,
      input.metadata ?? {},
    ],
  );
}

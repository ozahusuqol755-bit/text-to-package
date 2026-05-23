import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

interface PipelineLogRow {
  id: string;
  ts: Date;
  stage: string;
  entity_type: string | null;
  entity_id: string | null;
  actor: string | null;
  action: string | null;
  status_before: string | null;
  status_after: string | null;
  result: string | null;
  job_id: string | null;
  message: string;
  level: string;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
}

export async function logRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/logs", async () => {
    const result = await query<PipelineLogRow>(
      `
        select
          id,
          ts,
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
          metadata,
          created_at,
          updated_at
        from pipeline_logs
        order by ts desc
        limit 300
      `,
    );

    return { data: result.rows };
  });
}

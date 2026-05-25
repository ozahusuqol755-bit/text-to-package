import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { getAiStatus } from "../lib/ai.js";
import { buildAiUsageSummary, type AiUsageRow } from "../lib/aiUsage.js";

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/ai/status", async () => ({
    data: getAiStatus(),
  }));

  app.get("/api/ai/usage", async () => {
    const result = await query<AiUsageRow>(
      `
        select
          id,
          task_type,
          provider,
          model_used,
          key_alias,
          input_tokens,
          output_tokens,
          total_tokens,
          estimated_cost,
          status,
          error_message,
          created_at
        from ai_usage_logs
        order by created_at desc
        limit 100
      `,
    );

    return {
      data: {
        records: result.rows,
        summary: buildAiUsageSummary(result.rows),
      },
    };
  });
}

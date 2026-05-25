import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { transaction } from "../db.js";
import { isAiConfigured, requestStructuredJson } from "../lib/ai.js";
import { writeAuditLog } from "../lib/auditLog.js";
import {
  buildDeterministicViralAnalysis,
  type DeterministicAnalysisInput,
  type ViralAnalysisPayload,
} from "../lib/viralContent.js";

interface SourceRow {
  id: string;
  title: string;
  url: string | null;
  source_type: string;
  status: string;
  raw_text: string | null;
  raw_payload: Record<string, unknown> | null;
  tags: unknown;
}

interface AnalysisRow {
  id: string;
  source_id: string | null;
  metric_id: string | null;
  source_refs: unknown;
  meaning: string;
  hook: string;
  angle: string;
  pain: string;
  promise: string;
  cta: string;
  risk_notes: string;
  risk_status: string;
  platform_fit: unknown;
  priority_score: number;
  decision: string;
  analysis_payload: unknown;
  created_at: Date;
  updated_at: Date;
}

const SourceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const BulkAnalysisBodySchema = z.object({
  source_ids: z.array(z.string().uuid()).min(1).max(20),
});

const AiAnalysisPayloadSchema = z.object({
  summary: z.string().min(1),
  why_it_worked: z.string().min(1),
  audience: z.string().min(1),
  hook: z.string().min(1),
  angle: z.string().min(1),
  format_pattern: z.string().min(1),
  metrics_signal: z.object({
    strength: z.enum(["low", "medium", "high"]),
    reason: z.string().min(1),
  }),
  content_opportunities: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
});

function analysisColumns(): string {
  return `
    id,
    source_id,
    metric_id,
    source_refs,
    meaning,
    hook,
    angle,
    pain,
    promise,
    cta,
    risk_notes,
    risk_status,
    platform_fit,
    priority_score,
    decision,
    analysis_payload,
    created_at,
    updated_at
  `;
}

function analysisFromPayload(payload: ViralAnalysisPayload): DeterministicAnalysisInput {
  return {
    meaning: payload.summary,
    hook: payload.hook,
    angle: payload.angle,
    pain: `Why it worked: ${payload.why_it_worked}`,
    promise: "Adapt the winning pattern into original content with source metrics preserved.",
    cta: "Review the generated analysis and decide whether it should become an idea.",
    risk_notes: payload.risks.join(" | ") || "AI-generated ViralMaxing analysis.",
    risk_status: "active",
    platform_fit: ["telegram"],
    priority_score:
      payload.metrics_signal.strength === "high"
        ? 85
        : payload.metrics_signal.strength === "medium"
          ? 60
          : 35,
    decision: "to_idea",
    payload,
  };
}

function buildAnalysisPrompt(source: SourceRow): string {
  return `
Analyze this ViralMaxing reference for AI Content Factory.

Question: why did this ref work and how should we adapt it for our content?

Source:
${JSON.stringify(
  {
    id: source.id,
    title: source.title,
    url: source.url,
    source_type: source.source_type,
    raw_text: source.raw_text,
    raw_payload: source.raw_payload,
    tags: source.tags,
  },
  null,
  2,
)}

Return exactly this JSON shape:
{
  "summary": "...",
  "why_it_worked": "...",
  "audience": "...",
  "hook": "...",
  "angle": "...",
  "format_pattern": "...",
  "metrics_signal": {
    "strength": "low|medium|high",
    "reason": "..."
  },
  "content_opportunities": ["...", "..."],
  "risks": ["...", "..."]
}
`;
}

async function buildAnalysisInput(source: SourceRow): Promise<{
  input: DeterministicAnalysisInput;
  auditActions: Array<{
    action: "ai_fallback_used" | "ai_error";
    result: "success" | "error";
    message: string;
    level: "info" | "error";
    metadata?: Record<string, unknown>;
  }>;
}> {
  const auditActions: Array<{
    action: "ai_fallback_used" | "ai_error";
    result: "success" | "error";
    message: string;
    level: "info" | "error";
    metadata?: Record<string, unknown>;
  }> = [];

  if (isAiConfigured()) {
    try {
      const aiResult = await requestStructuredJson(buildAnalysisPrompt(source));
      const payload = AiAnalysisPayloadSchema.parse(aiResult);
      return { input: analysisFromPayload(payload), auditActions };
    } catch (error) {
      auditActions.push({
        action: "ai_error",
        result: "error",
        message: "AI analysis failed; deterministic fallback used",
        level: "error",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  auditActions.push({
    action: "ai_fallback_used",
    result: "success",
    message: "Deterministic ViralMaxing analysis fallback used",
    level: "info",
    metadata: { reason: isAiConfigured() ? "ai_error" : "ai_not_configured" },
  });

  return { input: buildDeterministicViralAnalysis(source), auditActions };
}

async function createAnalysisFromSourceId(
  client: PoolClient,
  sourceId: string,
  actor: string | undefined,
): Promise<AnalysisRow | null> {
  const sourceResult = await client.query<SourceRow>(
    `
      select
        id,
        title,
        url,
        source_type,
        status,
        raw_text,
        raw_payload,
        tags
      from sources
      where id = $1
      for update
    `,
    [sourceId],
  );
  const source = sourceResult.rows[0];

  if (!source) {
    return null;
  }

  const { input, auditActions } = await buildAnalysisInput(source);
  const analysisResult = await client.query<AnalysisRow>(
    `
      insert into analyses (
        source_id,
        source_refs,
        meaning,
        hook,
        angle,
        pain,
        promise,
        cta,
        risk_notes,
        risk_status,
        platform_fit,
        priority_score,
        decision,
        analysis_payload
      )
      values ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14::jsonb)
      returning ${analysisColumns()}
    `,
    [
      source.id,
      JSON.stringify([source.id]),
      input.meaning,
      input.hook,
      input.angle,
      input.pain,
      input.promise,
      input.cta,
      input.risk_notes,
      input.risk_status,
      JSON.stringify(input.platform_fit),
      input.priority_score,
      input.decision,
      JSON.stringify(input.payload),
    ],
  );
  const createdAnalysis = analysisResult.rows[0];

  if (!createdAnalysis) {
    throw new Error("Analysis insert did not return a row.");
  }

  await client.query(
    `
      update sources
      set status = 'ready_for_analysis'
      where id = $1
    `,
    [source.id],
  );

  await writeAuditLog(
    {
      stage: "analysis",
      entityType: "analysis",
      entityId: createdAnalysis.id,
      ...(actor ? { actor } : {}),
      action: "create_analysis",
      statusAfter: createdAnalysis.decision,
      result: "success",
      message: "Analysis created from source",
      level: "success",
      metadata: { source_id: source.id },
    },
    client,
  );

  for (const auditAction of auditActions) {
    await writeAuditLog(
      {
        stage: "analysis",
        entityType: "analysis",
        entityId: createdAnalysis.id,
        ...(actor ? { actor } : {}),
        action: auditAction.action,
        result: auditAction.result,
        message: auditAction.message,
        level: auditAction.level,
        metadata: { source_id: source.id, ...auditAction.metadata },
      },
      client,
    );
  }

  return createdAnalysis;
}

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/analyses", async () => {
    const analyses = await transaction(async (client) => {
      const result = await client.query<AnalysisRow>(
        `
          select ${analysisColumns()}
          from analyses
          order by created_at desc
        `,
      );

      return result.rows;
    });

    return { data: analyses };
  });

  app.post("/api/sources/:id/to-analysis", async (request, reply) => {
    const parsedParams = SourceIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsedParams.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const analysis = await transaction(async (client) => {
      return createAnalysisFromSourceId(client, parsedParams.data.id, actor);
    });

    if (!analysis) {
      return reply.status(404).send({
        error: "not_found",
        message: "Source not found.",
      });
    }

    return reply.status(201).send({ data: analysis });
  });

  app.post("/api/sources/to-analysis-bulk", async (request, reply) => {
    const parsedBody = BulkAnalysisBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsedBody.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const sourceIds = [...new Set(parsedBody.data.source_ids)];

    await writeAuditLog({
      stage: "analysis",
      ...(actor ? { actor } : {}),
      action: "bulk_analysis_started",
      result: "success",
      message: `Bulk analysis started for ${sourceIds.length} refs`,
      level: "info",
      metadata: { source_ids: sourceIds },
    });

    const analyses: AnalysisRow[] = [];
    const errors: Array<{ source_id: string; error: string }> = [];

    for (const sourceId of sourceIds) {
      try {
        const created = await transaction(async (client) =>
          createAnalysisFromSourceId(client, sourceId, actor),
        );

        if (created) {
          analyses.push(created);
        } else {
          errors.push({ source_id: sourceId, error: "Source not found" });
        }
      } catch (error) {
        errors.push({
          source_id: sourceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await writeAuditLog({
      stage: "analysis",
      ...(actor ? { actor } : {}),
      action: errors.length > 0 ? "bulk_analysis_failed" : "bulk_analysis_finished",
      result: errors.length > 0 ? "warning" : "success",
      message:
        errors.length > 0
          ? `Bulk analysis finished with ${errors.length} errors`
          : `Bulk analysis finished for ${analyses.length} refs`,
      level: errors.length > 0 ? "warn" : "success",
      metadata: { source_ids: sourceIds, analysis_count: analyses.length, errors },
    });

    return reply.status(errors.length > 0 ? 207 : 201).send({
      data: {
        analysis_count: analyses.length,
        analyses,
        errors,
      },
    });
  });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { transaction } from "../db.js";
import { writeAuditLog } from "../lib/auditLog.js";

interface SourceRow {
  id: string;
  title: string;
  url: string | null;
  source_type: string;
  status: string;
  raw_text: string | null;
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
  created_at: Date;
  updated_at: Date;
}

const SourceIdParamsSchema = z.object({
  id: z.string().uuid(),
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
    created_at,
    updated_at
  `;
}

function buildAnalysisInput(source: SourceRow) {
  const baseText = source.raw_text?.trim() || source.title;
  const shortText = baseText.slice(0, 160);

  return {
    meaning: `Source "${source.title}" needs operator review before content production.`,
    hook: `What matters in "${source.title}"?`,
    angle: `Turn the source into a practical operator insight: ${shortText}`,
    pain: "Manual content workflows lose context between source intake and review.",
    promise: "Keep source context attached to every downstream content decision.",
    cta: "Review the generated analysis and decide whether it should become an idea.",
    risk_notes: "Deterministic placeholder analysis. Replace with executor output later.",
    risk_status: "active",
    platform_fit: ["telegram"],
    priority_score: 50,
    decision: "to_idea",
  };
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
      const sourceResult = await client.query<SourceRow>(
        `
          select
            id,
            title,
            url,
            source_type,
            status,
            raw_text,
            tags
          from sources
          where id = $1
          for update
        `,
        [parsedParams.data.id],
      );
      const source = sourceResult.rows[0];

      if (!source) {
        return null;
      }

      const input = buildAnalysisInput(source);
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
            decision
          )
          values ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
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

      return createdAnalysis;
    });

    if (!analysis) {
      return reply.status(404).send({
        error: "not_found",
        message: "Source not found.",
      });
    }

    return reply.status(201).send({ data: analysis });
  });
}

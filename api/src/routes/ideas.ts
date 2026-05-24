import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { transaction } from "../db.js";
import { writeAuditLog } from "../lib/auditLog.js";

interface AnalysisRow {
  id: string;
  source_id: string | null;
  source_refs: unknown;
  meaning: string;
  hook: string;
  angle: string;
  pain: string;
  promise: string;
  cta: string;
  priority_score: number;
  decision: string;
}

interface IdeaRow {
  id: string;
  topic: string;
  angle: string;
  source_refs: unknown;
  platform_targets: unknown;
  priority: string;
  priority_score: number;
  tags: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
}

const AnalysisIdParamsSchema = z.object({
  id: z.string().uuid(),
});

function ideaColumns(): string {
  return `
    id,
    topic,
    angle,
    source_refs,
    platform_targets,
    priority,
    priority_score,
    tags,
    status,
    created_at,
    updated_at
  `;
}

function normalizeSourceRefs(value: unknown, fallbackSourceId: string | null): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  return fallbackSourceId ? [fallbackSourceId] : [];
}

function priorityFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function buildIdeaInput(analysis: AnalysisRow) {
  const sourceRefs = normalizeSourceRefs(analysis.source_refs, analysis.source_id);

  return {
    topic: analysis.hook || analysis.meaning.slice(0, 120),
    angle: analysis.angle,
    source_refs: sourceRefs,
    platform_targets: ["telegram"],
    priority: priorityFromScore(analysis.priority_score),
    priority_score: analysis.priority_score,
    tags: ["generated", "analysis"],
    status: "draft",
  };
}

export async function ideaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/ideas", async () => {
    const ideas = await transaction(async (client) => {
      const result = await client.query<IdeaRow>(
        `
          select ${ideaColumns()}
          from ideas
          order by created_at desc
        `,
      );

      return result.rows;
    });

    return { data: ideas };
  });

  app.post("/api/analyses/:id/create-idea", async (request, reply) => {
    const parsedParams = AnalysisIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsedParams.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const idea = await transaction(async (client) => {
      const analysisResult = await client.query<AnalysisRow>(
        `
          select
            id,
            source_id,
            source_refs,
            meaning,
            hook,
            angle,
            pain,
            promise,
            cta,
            priority_score,
            decision
          from analyses
          where id = $1
          for update
        `,
        [parsedParams.data.id],
      );
      const analysis = analysisResult.rows[0];

      if (!analysis) {
        return null;
      }

      const input = buildIdeaInput(analysis);
      const ideaResult = await client.query<IdeaRow>(
        `
          insert into ideas (
            topic,
            angle,
            source_refs,
            platform_targets,
            priority,
            priority_score,
            tags,
            status
          )
          values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8)
          returning ${ideaColumns()}
        `,
        [
          input.topic,
          input.angle,
          JSON.stringify(input.source_refs),
          JSON.stringify(input.platform_targets),
          input.priority,
          input.priority_score,
          JSON.stringify(input.tags),
          input.status,
        ],
      );
      const createdIdea = ideaResult.rows[0];

      if (!createdIdea) {
        throw new Error("Idea insert did not return a row.");
      }

      await writeAuditLog(
        {
          stage: "ideas",
          entityType: "idea",
          entityId: createdIdea.id,
          ...(actor ? { actor } : {}),
          action: "create_idea",
          statusAfter: createdIdea.status,
          result: "success",
          message: "Idea created from analysis",
          level: "success",
          metadata: { analysis_id: analysis.id },
        },
        client,
      );

      return createdIdea;
    });

    if (!idea) {
      return reply.status(404).send({
        error: "not_found",
        message: "Analysis not found.",
      });
    }

    return reply.status(201).send({ data: idea });
  });
}

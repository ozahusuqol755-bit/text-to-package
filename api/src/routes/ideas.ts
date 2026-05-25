import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { transaction } from "../db.js";
import { isAiConfigured, requestStructuredJson } from "../lib/ai.js";
import { writeAuditLog } from "../lib/auditLog.js";
import {
  buildDeterministicIdea,
  type AnalysisForIdeaInput,
  type DeterministicIdeaInput,
  type IdeaPayload,
} from "../lib/viralContent.js";

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
  analysis_payload: unknown;
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
  idea_payload: unknown;
  created_at: Date;
  updated_at: Date;
}

const AnalysisIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const AiIdeaPayloadSchema = z.object({
  title: z.string().min(1),
  thesis: z.string().min(1),
  format: z.enum(["telegram_post", "short_video", "carousel", "thread", "article", "script"]),
  platform: z.enum([
    "telegram",
    "instagram",
    "tiktok",
    "youtube_shorts",
    "x",
    "linkedin",
    "universal",
  ]),
  hook: z.string().min(1),
  outline: z.array(z.string().min(1)).default([]),
  adaptation_note: z.string().min(1),
  risk_to_check: z.string().min(1),
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
    idea_payload,
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

function platformTargets(platform: IdeaPayload["platform"]): string[] {
  if (platform === "tiktok") return ["tiktok", "reels"];
  if (platform === "instagram") return ["instagram", "reels"];
  if (platform === "x") return ["x", "threads"];
  if (platform === "youtube_shorts") return ["video"];
  if (platform === "linkedin") return ["telegram"];

  return [platform === "universal" ? "telegram" : platform];
}

function ideaFromPayload(analysis: AnalysisRow, payload: IdeaPayload): DeterministicIdeaInput {
  const sourceRefs = normalizeSourceRefs(analysis.source_refs, analysis.source_id);

  return {
    topic: payload.title,
    angle: payload.thesis,
    source_refs: sourceRefs,
    platform_targets: platformTargets(payload.platform),
    priority: priorityFromScore(analysis.priority_score),
    priority_score: analysis.priority_score,
    tags: ["generated", "analysis", "viralmaxing"],
    status: "draft",
    payload,
  };
}

function buildIdeaPrompt(analysis: AnalysisRow): string {
  return `
Generate a content idea from this enriched ViralMaxing analysis.

The idea must adapt the pattern, not copy the original.

Analysis:
${JSON.stringify(
  {
    id: analysis.id,
    source_id: analysis.source_id,
    source_refs: analysis.source_refs,
    meaning: analysis.meaning,
    hook: analysis.hook,
    angle: analysis.angle,
    pain: analysis.pain,
    promise: analysis.promise,
    cta: analysis.cta,
    priority_score: analysis.priority_score,
    analysis_payload: analysis.analysis_payload,
  },
  null,
  2,
)}

Return exactly this JSON shape:
{
  "title": "...",
  "thesis": "...",
  "format": "telegram_post|short_video|carousel|thread|article|script",
  "platform": "telegram|instagram|tiktok|youtube_shorts|x|linkedin|universal",
  "hook": "...",
  "outline": ["...", "...", "..."],
  "adaptation_note": "...",
  "risk_to_check": "..."
}
`;
}

async function buildIdeaInput(analysis: AnalysisRow): Promise<{
  input: DeterministicIdeaInput;
  auditActions: Array<{
    action: "ai_request_started" | "ai_request_finished" | "ai_fallback_used" | "ai_error";
    result: "success" | "error";
    message: string;
    level: "info" | "success" | "error";
    metadata?: Record<string, unknown>;
  }>;
}> {
  const auditActions: Array<{
    action: "ai_request_started" | "ai_request_finished" | "ai_fallback_used" | "ai_error";
    result: "success" | "error";
    message: string;
    level: "info" | "success" | "error";
    metadata?: Record<string, unknown>;
  }> = [];

  if (isAiConfigured()) {
    auditActions.push({
      action: "ai_request_started",
      result: "success",
      message: "AI idea request started",
      level: "info",
      metadata: { provider: "openai-compatible" },
    });

    try {
      const aiResult = await requestStructuredJson(buildIdeaPrompt(analysis));
      const payload = AiIdeaPayloadSchema.parse(aiResult);
      auditActions.push({
        action: "ai_request_finished",
        result: "success",
        message: "AI idea request finished",
        level: "success",
        metadata: { provider: "openai-compatible" },
      });
      return { input: ideaFromPayload(analysis, payload), auditActions };
    } catch (error) {
      auditActions.push({
        action: "ai_error",
        result: "error",
        message: "AI idea generation failed; deterministic fallback used",
        level: "error",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  auditActions.push({
    action: "ai_fallback_used",
    result: "success",
    message: "Deterministic ViralMaxing idea fallback used",
    level: "info",
    metadata: { reason: isAiConfigured() ? "ai_error" : "ai_not_configured" },
  });

  return {
    input: buildDeterministicIdea({
      id: analysis.id,
      source_id: analysis.source_id,
      source_refs: analysis.source_refs,
      meaning: analysis.meaning,
      hook: analysis.hook,
      angle: analysis.angle,
      priority_score: analysis.priority_score,
      analysis_payload:
        analysis.analysis_payload && typeof analysis.analysis_payload === "object"
          ? analysis.analysis_payload
          : {},
    } satisfies AnalysisForIdeaInput),
    auditActions,
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

  const createIdeaHandler = async (request: FastifyRequest, reply: FastifyReply) => {
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
            decision,
            analysis_payload
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

      const { input, auditActions } = await buildIdeaInput(analysis);
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
            status,
            idea_payload
          )
          values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8, $9::jsonb)
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
          JSON.stringify(input.payload),
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

      for (const auditAction of auditActions) {
        await writeAuditLog(
          {
            stage: "ideas",
            entityType: "idea",
            entityId: createdIdea.id,
            ...(actor ? { actor } : {}),
            action: auditAction.action,
            result: auditAction.result,
            message: auditAction.message,
            level: auditAction.level,
            metadata: { analysis_id: analysis.id, ...auditAction.metadata },
          },
          client,
        );
      }

      return createdIdea;
    });

    if (!idea) {
      return reply.status(404).send({
        error: "not_found",
        message: "Analysis not found.",
      });
    }

    return reply.status(201).send({ data: idea });
  };

  app.post("/api/analyses/:id/create-idea", createIdeaHandler);
  app.post("/api/analysis/:id/to-idea", createIdeaHandler);
}

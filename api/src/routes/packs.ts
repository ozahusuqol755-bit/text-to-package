import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, transaction } from "../db.js";
import { isAiConfigured, requestStructuredJson } from "../lib/ai.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { canApprovePack } from "../lib/guards.js";
import {
  buildDeterministicContentPack,
  type ContentPackForIdeaInput,
  type ContentPackPayload,
  type DeterministicContentPackInput,
} from "../lib/viralContent.js";

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
}

interface SourceRow {
  id: string;
  title: string;
  url: string | null;
  raw_payload: Record<string, unknown> | null;
}

interface AnalysisRow {
  id: string;
  source_id: string | null;
  analysis_payload: unknown;
}

interface ContentPackRow {
  id: string;
  source_id: string | null;
  analysis_id: string | null;
  idea_id: string;
  title: string;
  platform: string | null;
  format: string | null;
  draft_text: string | null;
  hooks: unknown;
  captions: unknown;
  visual_brief: string | null;
  image_prompt: string | null;
  video_script: string | null;
  cta: string | null;
  checklist: unknown;
  status: string;
  content_pack_payload: unknown;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ContentAssetRow {
  id: string;
  pack_id: string;
  platform: string;
  format: string;
  text: string | null;
  image_prompt: string | null;
  video_prompt: string | null;
  source_refs: unknown;
  status: string;
  version: number;
  qc_score: number | null;
  created_at: Date;
  updated_at: Date;
}

interface ReviewCheckRow {
  id: string;
  pack_id: string;
  label: string;
  required: boolean;
  passed: boolean;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AssetInput {
  platform: "telegram" | "x" | "vk" | "tiktok";
  format: "post" | "caption" | "script";
  text: string;
  image_prompt: string;
  video_prompt: string;
  source_refs: string[];
  status: "ready_for_review";
  version: number;
  qc_score: number;
}

const IdeaIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const PackIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const RejectPackSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

const AiContentPackPayloadSchema = z.object({
  title: z.string().min(1),
  platform: z.literal("telegram"),
  format: z.literal("telegram_post"),
  draft_text: z.string().min(1),
  hooks: z.array(z.string().min(1)).min(1),
  captions: z.array(z.string().min(1)).default([]),
  visual_brief: z.string().min(1),
  image_prompt: z.string().min(1),
  video_script: z.string().min(1),
  cta: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1),
});

function packColumns(): string {
  return `
    id,
    source_id,
    analysis_id,
    idea_id,
    title,
    platform,
    format,
    draft_text,
    hooks,
    captions,
    visual_brief,
    image_prompt,
    video_script,
    cta,
    checklist,
    status,
    content_pack_payload,
    approved_by,
    approved_at,
    created_at,
    updated_at
  `;
}

function assetColumns(): string {
  return `
    id,
    pack_id,
    platform,
    format,
    text,
    image_prompt,
    video_prompt,
    source_refs,
    status,
    version,
    qc_score,
    created_at,
    updated_at
  `;
}

function checkColumns(): string {
  return `
    id,
    pack_id,
    label,
    required,
    passed,
    note,
    created_at,
    updated_at
  `;
}

function normalizeSourceRefs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  return [];
}

function buildPackTitle(idea: IdeaRow): string {
  return idea.topic.length > 96 ? `${idea.topic.slice(0, 93)}...` : idea.topic;
}

function readFirstSourceRef(value: unknown): string | null {
  return normalizeSourceRefs(value)[0] ?? null;
}

function contentPackFromPayload(
  idea: ContentPackForIdeaInput["idea"],
  analysis: ContentPackForIdeaInput["analysis"],
  source: ContentPackForIdeaInput["source"],
  payload: ContentPackPayload,
): DeterministicContentPackInput {
  return {
    source_id: analysis?.source_id ?? source?.id ?? null,
    analysis_id: analysis?.id ?? null,
    idea_id: idea.id,
    status: "drafted",
    ...payload,
    payload: {
      ...payload,
      source_id: analysis?.source_id ?? source?.id ?? null,
      analysis_id: analysis?.id ?? null,
      idea_id: idea.id,
    },
  };
}

function buildContentPackPrompt(input: ContentPackForIdeaInput): string {
  return `
Generate a Telegram content pack from this Idea, Analysis, and source metrics.

Rules:
- Do not invent outside context.
- Adapt the source pattern; do not copy the original.
- Use source metrics as evidence for the angle and checklist.
- Return only valid JSON.

Input:
${JSON.stringify(input, null, 2)}

Return exactly this JSON shape:
{
  "title": "...",
  "platform": "telegram",
  "format": "telegram_post",
  "draft_text": "...",
  "hooks": ["...", "...", "..."],
  "captions": ["...", "..."],
  "visual_brief": "...",
  "image_prompt": "...",
  "video_script": "...",
  "cta": "...",
  "checklist": ["...", "...", "..."]
}
`;
}

async function buildContentPackInput(input: ContentPackForIdeaInput): Promise<{
  packInput: DeterministicContentPackInput;
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
      message: "AI content pack request started",
      level: "info",
      metadata: { provider: "openai-compatible" },
    });

    try {
      const aiResult = await requestStructuredJson(buildContentPackPrompt(input));
      const payload = AiContentPackPayloadSchema.parse(aiResult);
      auditActions.push({
        action: "ai_request_finished",
        result: "success",
        message: "AI content pack request finished",
        level: "success",
        metadata: { provider: "openai-compatible" },
      });
      return {
        packInput: contentPackFromPayload(
          input.idea,
          input.analysis ?? null,
          input.source ?? null,
          payload,
        ),
        auditActions,
      };
    } catch (error) {
      auditActions.push({
        action: "ai_error",
        result: "error",
        message: "AI content pack generation failed; deterministic fallback used",
        level: "error",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  auditActions.push({
    action: "ai_fallback_used",
    result: "success",
    message: "Deterministic content pack fallback used",
    level: "info",
    metadata: { reason: isAiConfigured() ? "ai_error" : "ai_not_configured" },
  });

  return { packInput: buildDeterministicContentPack(input), auditActions };
}

function buildAssets(idea: IdeaRow): AssetInput[] {
  const sourceRefs = normalizeSourceRefs(idea.source_refs);
  const topic = idea.topic;
  const angle = idea.angle;

  return [
    {
      platform: "telegram",
      format: "post",
      text: `Telegram post: ${topic}\n\nAngle: ${angle}\n\nOperator note: verify facts and source context before approval.`,
      image_prompt: `Editorial Telegram image for "${topic}" with clear content-factory context.`,
      video_prompt: `Short vertical explainer outline for "${topic}" with a practical operator takeaway.`,
      source_refs: sourceRefs,
      status: "ready_for_review",
      version: 1,
      qc_score: 82,
    },
    {
      platform: "x",
      format: "caption",
      text: `X/Threads caption: ${topic}. ${angle} Source context stays attached before publishing.`,
      image_prompt: `Minimal social card for X and Threads about "${topic}".`,
      video_prompt: `Fast-cut social clip script for X and Threads: hook, insight, operator CTA.`,
      source_refs: sourceRefs,
      status: "ready_for_review",
      version: 1,
      qc_score: 80,
    },
    {
      platform: "vk",
      format: "post",
      text: `VK post: ${topic}\n\n${angle}\n\nCheck source references and review checklist before approval.`,
      image_prompt: `VK feed image concept for "${topic}" with a grounded editorial style.`,
      video_prompt: `VK clip brief for "${topic}" with intro, key point, and review CTA.`,
      source_refs: sourceRefs,
      status: "ready_for_review",
      version: 1,
      qc_score: 81,
    },
    {
      platform: "tiktok",
      format: "script",
      text: `Reels/TikTok script: open with "${topic}", explain the angle, close with one practical next step.`,
      image_prompt: `Vertical cover frame for Reels and TikTok about "${topic}".`,
      video_prompt: `Reels/TikTok video prompt: 20 seconds, hook first, operator insight second, CTA last.`,
      source_refs: sourceRefs,
      status: "ready_for_review",
      version: 1,
      qc_score: 79,
    },
  ];
}

async function getReviewFacts(client: PoolClient, packId: string) {
  const result = await client.query<{
    asset_count: number;
    assets_with_refs: number;
  }>(
    `
      select
        count(*)::int as asset_count,
        coalesce(
          sum(case when jsonb_array_length(source_refs) > 0 then 1 else 0 end),
          0
        )::int as assets_with_refs
      from content_assets
      where pack_id = $1
    `,
    [packId],
  );

  return result.rows[0] ?? { asset_count: 0, assets_with_refs: 0 };
}

async function ensureReviewChecks(client: PoolClient, packId: string): Promise<ReviewCheckRow[]> {
  const facts = await getReviewFacts(client, packId);
  const checksInput = [
    {
      label: "source_refs_present",
      required: true,
      passed: facts.assets_with_refs > 0,
      note: "Content pack keeps source references attached.",
    },
    {
      label: "platform_versions_present",
      required: true,
      passed: facts.asset_count >= 4,
      note: "Telegram, X/Threads, VK, and Reels/TikTok drafts are present.",
    },
    {
      label: "publish_gate_ready",
      required: false,
      passed: false,
      note: "Publish remains blocked until status approved, approved_by, and approved_at are set.",
    },
    {
      label: "human_review_required",
      required: true,
      passed: false,
      note: "Operator review must pass before approval.",
    },
  ];

  const existingResult = await client.query<{ label: string }>(
    `
      select label
      from review_checks
      where pack_id = $1
    `,
    [packId],
  );
  const existingLabels = new Set(existingResult.rows.map((row) => row.label));

  for (const check of checksInput) {
    if (existingLabels.has(check.label)) {
      await client.query(
        `
          update review_checks
          set
            required = $3,
            passed = $4,
            note = $5
          where pack_id = $1 and label = $2
        `,
        [packId, check.label, check.required, check.passed, check.note],
      );
      continue;
    }

    await client.query(
      `
        insert into review_checks (
          pack_id,
          label,
          required,
          passed,
          note
        )
        values ($1, $2, $3, $4, $5)
      `,
      [packId, check.label, check.required, check.passed, check.note],
    );
  }

  const checksResult = await client.query<ReviewCheckRow>(
    `
      select ${checkColumns()}
      from review_checks
      where pack_id = $1
      order by created_at asc
    `,
    [packId],
  );

  return checksResult.rows;
}

export async function packRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/content-packs", async () => {
    const result = await query<ContentPackRow>(
      `
        select ${packColumns()}
        from content_packs
        order by created_at desc
      `,
    );

    return { data: result.rows };
  });

  app.get("/api/content-assets", async () => {
    const result = await query<ContentAssetRow>(
      `
        select ${assetColumns()}
        from content_assets
        order by created_at desc
      `,
    );

    return { data: result.rows };
  });

  app.get("/api/review-checks", async () => {
    const result = await query<ReviewCheckRow>(
      `
        select ${checkColumns()}
        from review_checks
        order by created_at desc
      `,
    );

    return { data: result.rows };
  });

  app.post("/api/ideas/:id/build-pack", async (request, reply) => {
    const parsedParams = IdeaIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsedParams.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const result = await transaction(async (client) => {
      const ideaResult = await client.query<IdeaRow>(
        `
          select
            id,
            topic,
            angle,
            source_refs,
            platform_targets,
            priority,
            priority_score,
            tags,
            status
          from ideas
          where id = $1
          for update
        `,
        [parsedParams.data.id],
      );
      const idea = ideaResult.rows[0];

      if (!idea) {
        return null;
      }

      const packResult = await client.query<ContentPackRow>(
        `
          insert into content_packs (
            idea_id,
            title,
            status
          )
          values ($1, $2, $3)
          returning ${packColumns()}
        `,
        [idea.id, buildPackTitle(idea), "ready_for_review"],
      );
      const pack = packResult.rows[0];

      if (!pack) {
        throw new Error("Content pack insert did not return a row.");
      }

      const assets: ContentAssetRow[] = [];
      for (const asset of buildAssets(idea)) {
        const assetResult = await client.query<ContentAssetRow>(
          `
            insert into content_assets (
              pack_id,
              platform,
              format,
              text,
              image_prompt,
              video_prompt,
              source_refs,
              status,
              version,
              qc_score
            )
            values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
            returning ${assetColumns()}
          `,
          [
            pack.id,
            asset.platform,
            asset.format,
            asset.text,
            asset.image_prompt,
            asset.video_prompt,
            JSON.stringify(asset.source_refs),
            asset.status,
            asset.version,
            asset.qc_score,
          ],
        );
        const createdAsset = assetResult.rows[0];

        if (!createdAsset) {
          throw new Error("Content asset insert did not return a row.");
        }

        assets.push(createdAsset);
      }

      const checksInput = [
        {
          label: "source_refs_present",
          required: true,
          passed: normalizeSourceRefs(idea.source_refs).length > 0,
          note: "Content pack keeps source references attached.",
        },
        {
          label: "platform_versions_present",
          required: true,
          passed: assets.length === 4,
          note: "Telegram, X/Threads, VK, and Reels/TikTok drafts are present.",
        },
        {
          label: "publish_gate_ready",
          required: false,
          passed: false,
          note: "Publish remains blocked until status approved, approved_by, and approved_at are set.",
        },
        {
          label: "human_review_required",
          required: true,
          passed: false,
          note: "Operator review must pass before approval.",
        },
      ];

      const checks: ReviewCheckRow[] = [];
      for (const check of checksInput) {
        const checkResult = await client.query<ReviewCheckRow>(
          `
            insert into review_checks (
              pack_id,
              label,
              required,
              passed,
              note
            )
            values ($1, $2, $3, $4, $5)
            returning ${checkColumns()}
          `,
          [pack.id, check.label, check.required, check.passed, check.note],
        );
        const createdCheck = checkResult.rows[0];

        if (!createdCheck) {
          throw new Error("Review check insert did not return a row.");
        }

        checks.push(createdCheck);
      }

      await client.query(
        `
          update ideas
          set status = 'in_pack'
          where id = $1
        `,
        [idea.id],
      );

      await writeAuditLog(
        {
          stage: "content_packs",
          entityType: "content_pack",
          entityId: pack.id,
          ...(actor ? { actor } : {}),
          action: "build_content_pack",
          statusAfter: pack.status,
          result: "success",
          message: "Content pack built from idea",
          level: "success",
          metadata: { idea_id: idea.id, asset_count: assets.length },
        },
        client,
      );

      return { pack, assets, review_checks: checks };
    });

    if (!result) {
      return reply.status(404).send({
        error: "not_found",
        message: "Idea not found.",
      });
    }

    return reply.status(201).send({ data: result });
  });

  app.post("/api/ideas/:id/to-content-pack", async (request, reply) => {
    const parsedParams = IdeaIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsedParams.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const result = await transaction(async (client) => {
      const ideaResult = await client.query<IdeaRow>(
        `
          select
            id,
            topic,
            angle,
            source_refs,
            platform_targets,
            priority,
            priority_score,
            tags,
            status,
            idea_payload
          from ideas
          where id = $1
          for update
        `,
        [parsedParams.data.id],
      );
      const idea = ideaResult.rows[0];

      if (!idea) {
        return null;
      }

      const sourceId = readFirstSourceRef(idea.source_refs);
      const sourceResult = sourceId
        ? await client.query<SourceRow>(
            `
              select
                id,
                title,
                url,
                raw_payload
              from sources
              where id = $1
            `,
            [sourceId],
          )
        : null;
      const source = sourceResult?.rows[0] ?? null;
      const analysisResult = sourceId
        ? await client.query<AnalysisRow>(
            `
              select
                id,
                source_id,
                analysis_payload
              from analyses
              where source_id = $1
              order by created_at desc
              limit 1
            `,
            [sourceId],
          )
        : null;
      const analysis = analysisResult?.rows[0] ?? null;
      const contentInput: ContentPackForIdeaInput = {
        idea: {
          id: idea.id,
          topic: idea.topic,
          angle: idea.angle,
          source_refs: idea.source_refs,
          platform_targets: idea.platform_targets,
          priority_score: idea.priority_score,
          idea_payload:
            idea.idea_payload && typeof idea.idea_payload === "object" ? idea.idea_payload : {},
        },
        analysis: analysis
          ? {
              id: analysis.id,
              source_id: analysis.source_id,
              analysis_payload:
                analysis.analysis_payload && typeof analysis.analysis_payload === "object"
                  ? analysis.analysis_payload
                  : {},
            }
          : null,
        source,
      };
      const { packInput, auditActions } = await buildContentPackInput(contentInput);
      const packResult = await client.query<ContentPackRow>(
        `
          insert into content_packs (
            source_id,
            analysis_id,
            idea_id,
            title,
            platform,
            format,
            draft_text,
            hooks,
            captions,
            visual_brief,
            image_prompt,
            video_script,
            cta,
            checklist,
            status,
            content_pack_payload
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb
          )
          returning ${packColumns()}
        `,
        [
          packInput.source_id,
          packInput.analysis_id,
          packInput.idea_id,
          packInput.title,
          packInput.platform,
          packInput.format,
          packInput.draft_text,
          JSON.stringify(packInput.hooks),
          JSON.stringify(packInput.captions),
          packInput.visual_brief,
          packInput.image_prompt,
          packInput.video_script,
          packInput.cta,
          JSON.stringify(packInput.checklist),
          packInput.status,
          JSON.stringify(packInput.payload),
        ],
      );
      const pack = packResult.rows[0];

      if (!pack) {
        throw new Error("Content pack insert did not return a row.");
      }

      const assetResult = await client.query<ContentAssetRow>(
        `
          insert into content_assets (
            pack_id,
            platform,
            format,
            text,
            image_prompt,
            video_prompt,
            source_refs,
            status,
            version,
            qc_score
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
          returning ${assetColumns()}
        `,
        [
          pack.id,
          "telegram",
          "post",
          packInput.draft_text,
          packInput.image_prompt,
          packInput.video_script,
          JSON.stringify(normalizeSourceRefs(idea.source_refs)),
          "draft",
          1,
          82,
        ],
      );
      const asset = assetResult.rows[0];

      if (!asset) {
        throw new Error("Content asset insert did not return a row.");
      }

      const checks = await ensureReviewChecks(client, pack.id);

      await client.query(
        `
          update ideas
          set status = 'in_pack'
          where id = $1
        `,
        [idea.id],
      );

      await writeAuditLog(
        {
          stage: "content_packs",
          entityType: "content_pack",
          entityId: pack.id,
          ...(actor ? { actor } : {}),
          action: "build_content_pack",
          statusAfter: pack.status,
          result: "success",
          message: "Content pack generated from idea",
          level: "success",
          metadata: {
            source_id: pack.source_id,
            analysis_id: pack.analysis_id,
            idea_id: idea.id,
            asset_count: 1,
          },
        },
        client,
      );

      for (const auditAction of auditActions) {
        await writeAuditLog(
          {
            stage: "content_packs",
            entityType: "content_pack",
            entityId: pack.id,
            ...(actor ? { actor } : {}),
            action: auditAction.action,
            result: auditAction.result,
            message: auditAction.message,
            level: auditAction.level,
            metadata: {
              source_id: pack.source_id,
              analysis_id: pack.analysis_id,
              idea_id: idea.id,
              ...auditAction.metadata,
            },
          },
          client,
        );
      }

      return { pack, assets: [asset], review_checks: checks };
    });

    if (!result) {
      return reply.status(404).send({
        error: "not_found",
        message: "Idea not found.",
      });
    }

    return reply.status(201).send({ data: result });
  });

  app.post("/api/content-packs/:id/send-to-review", async (request, reply) => {
    const parsedParams = PackIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsedParams.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const result = await transaction(async (client) => {
      const packResult = await client.query<ContentPackRow>(
        `
          select ${packColumns()}
          from content_packs
          where id = $1
          for update
        `,
        [parsedParams.data.id],
      );
      const pack = packResult.rows[0];

      if (!pack) {
        return null;
      }

      const checks = await ensureReviewChecks(client, pack.id);
      const updatedPackResult = await client.query<ContentPackRow>(
        `
          update content_packs
          set status = 'ready_for_review'
          where id = $1
          returning ${packColumns()}
        `,
        [pack.id],
      );
      const updatedPack = updatedPackResult.rows[0];

      if (!updatedPack) {
        throw new Error("Content pack update did not return a row.");
      }

      await writeAuditLog(
        {
          stage: "review",
          entityType: "content_pack",
          entityId: updatedPack.id,
          ...(actor ? { actor } : {}),
          action: "send_to_review",
          statusBefore: pack.status,
          statusAfter: updatedPack.status,
          result: "success",
          message: "Content pack sent to review",
          level: "success",
        },
        client,
      );

      return { pack: updatedPack, review_checks: checks };
    });

    if (!result) {
      return reply.status(404).send({
        error: "not_found",
        message: "Content pack not found.",
      });
    }

    return reply.status(200).send({ data: result });
  });

  app.post("/api/content-packs/:id/approve", async (request, reply) => {
    const parsedParams = PackIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsedParams.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id ?? "operator_kz";
    const result = await transaction(async (client) => {
      const packResult = await client.query<ContentPackRow>(
        `
          select ${packColumns()}
          from content_packs
          where id = $1
          for update
        `,
        [parsedParams.data.id],
      );
      const pack = packResult.rows[0];

      if (!pack) {
        return null;
      }

      const checks = await ensureReviewChecks(client, pack.id);

      if (!canApprovePack(checks)) {
        const failedChecks = checks
          .filter(
            (check) => check.required && check.label !== "human_review_required" && !check.passed,
          )
          .map((check) => check.label);

        return {
          gateFailed: true as const,
          failed_checks: failedChecks,
        };
      }

      await client.query(
        `
          update review_checks
          set
            passed = true,
            note = 'Operator approval completed human review.'
          where pack_id = $1 and label = 'human_review_required'
        `,
        [pack.id],
      );

      const updatedPackResult = await client.query<ContentPackRow>(
        `
          update content_packs
          set
            status = 'approved',
            approved_by = $2,
            approved_at = now()
          where id = $1
          returning ${packColumns()}
        `,
        [pack.id, actor],
      );
      const updatedPack = updatedPackResult.rows[0];

      if (!updatedPack) {
        throw new Error("Content pack approval did not return a row.");
      }

      const updatedChecksResult = await client.query<ReviewCheckRow>(
        `
          select ${checkColumns()}
          from review_checks
          where pack_id = $1
          order by created_at asc
        `,
        [pack.id],
      );

      await writeAuditLog(
        {
          stage: "review",
          entityType: "content_pack",
          entityId: updatedPack.id,
          actor,
          action: "approve_content_pack",
          statusBefore: pack.status,
          statusAfter: updatedPack.status,
          result: "success",
          message: "Content pack approved",
          level: "success",
        },
        client,
      );

      return { pack: updatedPack, review_checks: updatedChecksResult.rows };
    });

    if (!result) {
      return reply.status(404).send({
        error: "not_found",
        message: "Content pack not found.",
      });
    }

    if ("gateFailed" in result) {
      return reply.status(400).send({
        error: "approve_gate_failed",
        message: "Required review checks must pass before approval.",
        failed_checks: result.failed_checks,
      });
    }

    return reply.status(200).send({ data: result });
  });

  app.post("/api/content-packs/:id/reject", async (request, reply) => {
    const parsedParams = PackIdParamsSchema.safeParse(request.params);
    const parsedBody = RejectPackSchema.safeParse(request.body ?? {});

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: [
          ...(!parsedParams.success ? parsedParams.error.issues : []),
          ...(!parsedBody.success ? parsedBody.error.issues : []),
        ],
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const result = await transaction(async (client) => {
      const packResult = await client.query<ContentPackRow>(
        `
          select ${packColumns()}
          from content_packs
          where id = $1
          for update
        `,
        [parsedParams.data.id],
      );
      const pack = packResult.rows[0];

      if (!pack) {
        return null;
      }

      const updatedPackResult = await client.query<ContentPackRow>(
        `
          update content_packs
          set
            status = 'rejected',
            approved_by = null,
            approved_at = null
          where id = $1
          returning ${packColumns()}
        `,
        [pack.id],
      );
      const updatedPack = updatedPackResult.rows[0];

      if (!updatedPack) {
        throw new Error("Content pack rejection did not return a row.");
      }

      await writeAuditLog(
        {
          stage: "review",
          entityType: "content_pack",
          entityId: updatedPack.id,
          ...(actor ? { actor } : {}),
          action: "reject_content_pack",
          statusBefore: pack.status,
          statusAfter: updatedPack.status,
          result: "success",
          message: "Content pack rejected",
          level: "success",
          metadata: { reason: parsedBody.data.reason ?? null },
        },
        client,
      );

      return updatedPack;
    });

    if (!result) {
      return reply.status(404).send({
        error: "not_found",
        message: "Content pack not found.",
      });
    }

    return reply.status(200).send({ data: result });
  });
}

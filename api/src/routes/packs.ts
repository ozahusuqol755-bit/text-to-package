import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query, transaction } from "../db.js";
import { writeAuditLog } from "../lib/auditLog.js";

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
}

interface ContentPackRow {
  id: string;
  idea_id: string;
  title: string;
  status: string;
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

function packColumns(): string {
  return `
    id,
    idea_id,
    title,
    status,
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
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { writeAuditLog } from "../lib/auditLog.js";

interface SourceRow {
  id: string;
  title: string;
  url: string | null;
  source_type: string;
  status: string;
  raw_text: string | null;
  summary: string | null;
  hooks: unknown;
  cta: string | null;
  format: string | null;
  source_risk: string | null;
  tags: unknown;
  created_at: Date;
  updated_at: Date;
}

const CreateSourceSchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    url: z.string().trim().url().optional(),
    source_type: z.enum(["url", "text", "manual"]),
    raw_text: z.string().trim().optional(),
    tags: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (value.source_type === "url" && !value.url) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "url is required when source_type is url",
      });
    }
  });

function sourceColumns(): string {
  return `
    id,
    title,
    url,
    source_type,
    status,
    raw_text,
    summary,
    hooks,
    cta,
    format,
    source_risk,
    tags,
    created_at,
    updated_at
  `;
}

export async function sourceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/sources", async () => {
    const result = await query<SourceRow>(
      `
        select ${sourceColumns()}
        from sources
        order by created_at desc
      `,
    );

    return { data: result.rows };
  });

  app.post("/api/sources", async (request, reply) => {
    const parsed = CreateSourceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    const input = parsed.data;
    const result = await query<SourceRow>(
      `
        insert into sources (
          title,
          url,
          source_type,
          raw_text,
          tags
        )
        values ($1, $2, $3, $4, $5::jsonb)
        returning ${sourceColumns()}
      `,
      [
        input.title,
        input.url ?? null,
        input.source_type,
        input.raw_text ?? null,
        JSON.stringify(input.tags),
      ],
    );

    const source = result.rows[0];
    if (!source) {
      throw new Error("Source insert did not return a row.");
    }

    const actor = request.actor?.username ?? request.actor?.id;

    await writeAuditLog({
      stage: "sources",
      entityType: "source",
      entityId: source.id,
      ...(actor ? { actor } : {}),
      action: "create_source",
      statusAfter: source.status,
      result: "success",
      message: "Source created",
      level: "success",
    });

    return reply.status(201).send({ data: source });
  });
}

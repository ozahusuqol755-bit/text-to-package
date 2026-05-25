import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query, transaction } from "../db.js";
import { writeAuditLog } from "../lib/auditLog.js";
import {
  buildGoogleSheetCsvUrl,
  parseViralMaxingCsv,
  type ViralMaxingImportRow,
} from "../lib/sourceImport.js";

interface SourceRow {
  id: string;
  title: string;
  url: string | null;
  source_type: string;
  status: string;
  raw_text: string | null;
  raw_payload: unknown;
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
    source_type: z.enum(["url", "text", "manual", "viralmaxing"]),
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

const ImportGoogleSheetSchema = z.object({
  url: z.string().trim().url(),
});

const ImportCsvSchema = z.object({
  csv: z.string().trim().min(1, "csv is required"),
  source: z.string().trim().optional(),
});

function sourceColumns(): string {
  return `
    id,
    title,
    url,
    source_type,
    status,
    raw_text,
    raw_payload,
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

async function importViralMaxingRows({
  rows,
  actor,
  importSource,
}: {
  rows: ViralMaxingImportRow[];
  actor?: string;
  importSource: string;
}): Promise<SourceRow[]> {
  return transaction(async (client) => {
    const imported: SourceRow[] = [];

    for (const row of rows) {
      const result = await client.query<SourceRow>(
        `
          insert into sources (
            title,
            url,
            source_type,
            status,
            raw_text,
            raw_payload,
            tags
          )
          values ($1, $2, 'viralmaxing', 'imported', $3, $4::jsonb, $5::jsonb)
          returning ${sourceColumns()}
        `,
        [
          row.title,
          row.url,
          row.rawPayload.caption ?? row.rawPayload.title ?? null,
          JSON.stringify(row.rawPayload),
          JSON.stringify(row.tags),
        ],
      );
      const source = result.rows[0];
      if (!source) {
        throw new Error("Source insert did not return a row.");
      }

      imported.push(source);

      await writeAuditLog(
        {
          stage: "sources",
          entityType: "source",
          entityId: source.id,
          ...(actor ? { actor } : {}),
          action: "create_source",
          statusAfter: source.status,
          result: "success",
          message: "Source created",
          level: "success",
          metadata: {
            import_source: importSource,
            source_type: "viralmaxing",
          },
        },
        client,
      );
    }

    await writeAuditLog(
      {
        stage: "sources",
        entityType: "source",
        ...(actor ? { actor } : {}),
        action: "import_refs_finished",
        statusAfter: "imported",
        result: "success",
        message: `Imported ${imported.length} refs from ViralMaxing`,
        level: "success",
        metadata: {
          import_source: importSource,
          count: imported.length,
        },
      },
      client,
    );

    return imported;
  });
}

async function runImport({
  csv,
  actor,
  importSource,
}: {
  csv: string;
  actor?: string;
  importSource: string;
}): Promise<SourceRow[]> {
  await writeAuditLog({
    stage: "sources",
    entityType: "source",
    ...(actor ? { actor } : {}),
    action: "import_refs_started",
    result: "success",
    message: "ViralMaxing refs import started",
    level: "info",
    metadata: { import_source: importSource },
  });

  try {
    const rows = parseViralMaxingCsv(csv);
    return await importViralMaxingRows({ rows, ...(actor ? { actor } : {}), importSource });
  } catch (error) {
    await writeAuditLog({
      stage: "sources",
      entityType: "source",
      ...(actor ? { actor } : {}),
      action: "import_refs_failed",
      result: "error",
      message: "ViralMaxing refs import failed",
      level: "error",
      metadata: {
        import_source: importSource,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
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

  app.post("/api/sources/import/csv", async (request, reply) => {
    const parsed = ImportCsvSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const sources = await runImport({
      csv: parsed.data.csv,
      ...(actor ? { actor } : {}),
      importSource: parsed.data.source ?? "csv",
    });

    return reply.status(201).send({
      data: {
        imported_count: sources.length,
        sources,
      },
    });
  });

  app.post("/api/sources/import/google-sheet", async (request, reply) => {
    const parsed = ImportGoogleSheetSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    const actor = request.actor?.username ?? request.actor?.id;
    const csvUrl = buildGoogleSheetCsvUrl(parsed.data.url);

    await writeAuditLog({
      stage: "sources",
      entityType: "source",
      ...(actor ? { actor } : {}),
      action: "import_refs_started",
      result: "success",
      message: "ViralMaxing refs import started",
      level: "info",
      metadata: {
        import_source: "google_sheet",
        url: parsed.data.url,
        csv_url: csvUrl,
      },
    });

    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets CSV export returned ${response.status}`);
      }

      const csv = await response.text();
      const rows = parseViralMaxingCsv(csv);
      const sources = await importViralMaxingRows({
        rows,
        ...(actor ? { actor } : {}),
        importSource: "google_sheet",
      });

      return reply.status(201).send({
        data: {
          imported_count: sources.length,
          sources,
        },
      });
    } catch (error) {
      await writeAuditLog({
        stage: "sources",
        entityType: "source",
        ...(actor ? { actor } : {}),
        action: "import_refs_failed",
        result: "error",
        message: "ViralMaxing refs import failed",
        level: "error",
        metadata: {
          import_source: "google_sheet",
          url: parsed.data.url,
          csv_url: csvUrl,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  });
}

import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

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

export async function sourceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/sources", async () => {
    const result = await query<SourceRow>(
      `
        select
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
        from sources
        order by created_at desc
      `,
    );

    return { data: result.rows };
  });
}

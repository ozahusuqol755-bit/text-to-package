import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

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

export async function packRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/content-packs", async () => {
    const result = await query<ContentPackRow>(
      `
        select
          id,
          idea_id,
          title,
          status,
          approved_by,
          approved_at,
          created_at,
          updated_at
        from content_packs
        order by created_at desc
      `,
    );

    return { data: result.rows };
  });
}

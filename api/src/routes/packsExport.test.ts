import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = {
  query: vi.fn(),
};

vi.mock("../db.js", () => ({
  query: vi.fn(),
  transaction: vi.fn(async (fn: (client: typeof mockClient) => unknown) => fn(mockClient)),
}));

describe("pack markdown export route", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    mockClient.query.mockReset();
  });

  it("returns markdown attachment for an existing pack", async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes("from content_packs")) {
        return {
          rows: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              source_id: "22222222-2222-4222-8222-222222222222",
              analysis_id: "33333333-3333-4333-8333-333333333333",
              idea_id: "44444444-4444-4444-8444-444444444444",
              title: "Export Pack",
              platform: "telegram",
              format: "telegram_post",
              draft_text: "Draft text",
              hooks: ["Hook"],
              captions: ["Caption"],
              visual_brief: "Visual",
              image_prompt: "Image",
              video_script: "Video",
              cta: "CTA",
              checklist: ["Checklist item"],
              status: "drafted",
              content_pack_payload: {},
              approved_by: null,
              approved_at: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }

      if (sql.includes("from sources")) {
        return {
          rows: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              title: "Source",
              url: "https://example.com",
              raw_payload: { views: 1000 },
            },
          ],
        };
      }

      if (sql.includes("from analyses")) {
        return {
          rows: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              meaning: "Summary",
              hook: "Hook",
              angle: "Angle",
              analysis_payload: {},
            },
          ],
        };
      }

      if (sql.includes("from ideas")) {
        return {
          rows: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              topic: "Idea",
              angle: "Thesis",
              idea_payload: {},
            },
          ],
        };
      }

      if (sql.includes("from ai_usage_logs")) {
        return { rows: [{ task_type: "content_pack", model_used: null }] };
      }

      return { rows: [] };
    });

    const Fastify = (await import("fastify")).default;
    const { packRoutes } = await import("./packs");
    const app = Fastify({ logger: false });
    await packRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/packs/11111111-1111-4111-8111-111111111111/export/markdown",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/markdown");
    expect(response.headers["content-disposition"]).toContain("content-pack-11111111");
    expect(response.body).toContain("# Content Pack: Export Pack");
    expect(response.body).toContain("Draft text");
    expect(response.body).toContain("Checklist item");

    await app.close();
  });
});

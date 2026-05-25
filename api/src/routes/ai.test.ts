import { describe, expect, it } from "vitest";

describe("aiRoutes", () => {
  it("returns AI status without exposing API keys", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.AI_BASE_URL = "https://provider.example/v1";
    process.env.AI_API_KEY = "default-secret";
    process.env.AI_MODEL = "default-model";

    const Fastify = (await import("fastify")).default;
    const { aiRoutes } = await import("./ai");
    const app = Fastify({ logger: false });
    await aiRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/ai/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("secret");
    expect(response.json()).toMatchObject({
      data: {
        provider: "openai-compatible",
        mode: "configured",
        roles: {
          default: { configured: true, model: "default-model" },
        },
      },
    });

    await app.close();
  });
});

import { describe, expect, it } from "vitest";

describe("packRoutes", () => {
  it("registers POST /api/ideas/:id/to-content-pack and validates ids before DB access", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    const Fastify = (await import("fastify")).default;
    const { packRoutes } = await import("./packs");
    const app = Fastify({ logger: false });
    await packRoutes(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/ideas/not-a-uuid/to-content-pack",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "validation_error" });

    await app.close();
  });
});

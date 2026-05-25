import { describe, expect, it } from "vitest";

describe("parseStructuredJson", () => {
  it("parses JSON from markdown fenced AI output", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    const { parseStructuredJson } = await import("./ai");
    const result = parseStructuredJson('```json\n{"title":"Demo","items":["a"]}\n```');

    expect(result).toEqual({ title: "Demo", items: ["a"] });
  });

  it("repairs common trailing commas before parsing", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    const { parseStructuredJson } = await import("./ai");
    const result = parseStructuredJson('Here is JSON:\n{"title":"Demo","items":["a",],}');

    expect(result).toEqual({ title: "Demo", items: ["a"] });
  });

  it("throws a safe error when no JSON object exists", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    const { parseStructuredJson } = await import("./ai");
    expect(() => parseStructuredJson("not json")).toThrow("AI response did not contain JSON");
  });
});

describe("AI role config", () => {
  it("falls back to deterministic mode when base URL or keys are missing", async () => {
    const { resolveAiTaskConfigFromEnv } = await import("./ai");

    const result = resolveAiTaskConfigFromEnv("analysis", {
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "",
      AI_API_KEY: "",
      AI_MODEL: "",
    });

    expect(result.configured).toBe(false);
    expect(result.keyAlias).toBe("smart");
    expect(result.model).toBeNull();
    expect(result.apiKey).toBeNull();
  });

  it("uses role-specific key and model before default credentials", async () => {
    const { resolveAiTaskConfigFromEnv } = await import("./ai");

    const result = resolveAiTaskConfigFromEnv("content_pack", {
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "https://provider.example/v1",
      AI_API_KEY: "default-secret",
      AI_MODEL: "default-model",
      AI_WRITE_API_KEY: "write-secret",
      AI_WRITE_MODEL: "write-model",
    });

    expect(result.configured).toBe(true);
    expect(result.keyAlias).toBe("write");
    expect(result.model).toBe("write-model");
    expect(result.apiKey).toBe("write-secret");
  });

  it("keeps API keys out of the public status payload", async () => {
    const { buildAiStatusFromEnv } = await import("./ai");

    const status = buildAiStatusFromEnv({
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "https://provider.example/v1",
      AI_API_KEY: "default-secret",
      AI_MODEL: "default-model",
      AI_FAST_API_KEY: "fast-secret",
      AI_FAST_MODEL: "fast-model",
    });

    expect(JSON.stringify(status)).not.toContain("secret");
    expect(status.mode).toBe("configured");
    expect(status.roles.default).toEqual({ configured: true, model: "default-model" });
    expect(status.roles.fast).toEqual({ configured: true, model: "fast-model" });
  });
});

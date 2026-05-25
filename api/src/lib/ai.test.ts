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

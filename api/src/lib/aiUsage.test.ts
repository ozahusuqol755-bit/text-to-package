import { describe, expect, it } from "vitest";

describe("AI usage logging", () => {
  it("creates an ai_usage_logs insert record without requiring token counts", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    const { writeAiUsageLog } = await import("./aiUsage");
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const client = {
      query: async (text: string, params: unknown[]) => {
        calls.push({ text, params });
        return { rows: [], rowCount: 1 };
      },
    };

    await writeAiUsageLog(
      {
        taskType: "analysis",
        provider: "openai-compatible",
        modelUsed: null,
        keyAlias: "smart",
        status: "fallback",
      },
      client,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain("insert into ai_usage_logs");
    expect(calls[0].params).toEqual([
      "analysis",
      "openai-compatible",
      null,
      "smart",
      null,
      null,
      null,
      null,
      "fallback",
      null,
    ]);
  });

  it("summarizes usage by task type and key alias", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/content_factory";
    const { buildAiUsageSummary } = await import("./aiUsage");
    const summary = buildAiUsageSummary([
      {
        task_type: "analysis",
        key_alias: "smart",
        total_tokens: 100,
        estimated_cost: "0.10",
      },
      {
        task_type: "analysis",
        key_alias: "smart",
        total_tokens: null,
        estimated_cost: null,
      },
      {
        task_type: "content_pack",
        key_alias: "write",
        total_tokens: 50,
        estimated_cost: "0.05",
      },
    ]);

    expect(summary.by_task_type.analysis.count).toBe(2);
    expect(summary.by_task_type.analysis.total_tokens).toBe(100);
    expect(summary.by_key_alias.smart.count).toBe(2);
    expect(summary.total_tokens).toBe(150);
    expect(summary.estimated_cost).toBe(0.15);
  });
});

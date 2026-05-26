import { describe, expect, it } from "vitest";
import { buildContentPackMarkdown } from "./contentPackMarkdown";

describe("buildContentPackMarkdown", () => {
  it("exports a readable content pack with source metrics, analysis, idea, and draft fields", () => {
    const markdown = buildContentPackMarkdown({
      generatedAt: "2026-05-26T10:00:00.000Z",
      aiMode: "configured",
      aiUsage: { task_type: "content_pack", model_used: "writer-model" },
      pack: {
        id: "pack-1",
        source_id: "source-1",
        analysis_id: "analysis-1",
        idea_id: "idea-1",
        title: "Demo Pack",
        platform: "telegram",
        format: "telegram_post",
        draft_text: "Draft body",
        hooks: ["Hook 1", "Hook 2"],
        captions: ["Caption 1"],
        visual_brief: "Visual brief",
        image_prompt: "Image prompt",
        video_script: "Video script",
        cta: "CTA",
        checklist: ["Check source", "Check tone"],
        status: "drafted",
      },
      source: {
        id: "source-1",
        title: "Source title",
        url: "https://example.com/ref",
        raw_payload: {
          platform: "TikTok",
          author: "@demo",
          views: 100000,
          likes: 9000,
          comments: 800,
          shares: 1200,
          saves: 700,
          engagement_rate: 11.7,
        },
      },
      analysis: {
        id: "analysis-1",
        meaning: "Meaning fallback",
        hook: "Hook fallback",
        angle: "Angle fallback",
        analysis_payload: {
          summary: "Summary",
          why_it_worked: "Why it worked",
          audience: "Audience",
          hook: "Analysis hook",
          angle: "Analysis angle",
          format_pattern: "Format pattern",
          metrics_signal: { strength: "high", reason: "Strong metrics" },
          content_opportunities: ["Opportunity 1", "Opportunity 2"],
          risks: ["Risk 1"],
        },
      },
      idea: {
        id: "idea-1",
        topic: "Idea title",
        angle: "Idea thesis",
        idea_payload: {
          title: "Idea title",
          thesis: "Idea thesis",
          format: "telegram_post",
          platform: "telegram",
          hook: "Idea hook",
          outline: ["One", "Two", "Three"],
          adaptation_note: "Adaptation",
          risk_to_check: "Risk to check",
        },
      },
    });

    expect(markdown).toContain("# Content Pack: Demo Pack");
    expect(markdown).toContain("- URL: https://example.com/ref");
    expect(markdown).toContain("- Views: 100000");
    expect(markdown).toContain("### Why it worked\nWhy it worked");
    expect(markdown).toContain("### Draft text\nDraft body");
    expect(markdown).toContain("1. Hook 1");
    expect(markdown).toContain("- Check source");
    expect(markdown).toContain("Model used: writer-model");
  });

  it("uses Not available for missing fields and does not include secrets", () => {
    const markdown = buildContentPackMarkdown({
      generatedAt: "2026-05-26T10:00:00.000Z",
      aiMode: "fallback",
      pack: {
        id: "pack-2",
        source_id: null,
        analysis_id: null,
        idea_id: "idea-2",
        title: "Sparse Pack",
        platform: null,
        format: null,
        draft_text: null,
        hooks: [],
        captions: [],
        visual_brief: null,
        image_prompt: null,
        video_script: null,
        cta: null,
        checklist: [],
        status: "drafted",
        content_pack_payload: {
          AI_API_KEY: "secret-value",
        },
      },
    });

    expect(markdown).toContain("Not available");
    expect(markdown).not.toContain("secret-value");
    expect(markdown).not.toContain("AI_API_KEY");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDeterministicIdea,
  buildDeterministicViralAnalysis,
  type AnalysisForIdeaInput,
  type SourceForViralAnalysis,
} from "./viralContent";

describe("buildDeterministicViralAnalysis", () => {
  it("uses ViralMaxing metrics to classify a strong shareable ref", () => {
    const source: SourceForViralAnalysis = {
      id: "source-1",
      title: "Creator growth playbook",
      url: "https://example.com/ref",
      source_type: "viralmaxing",
      raw_text: "Short caption about creator systems",
      raw_payload: {
        views: 150_000,
        likes: 12_000,
        comments: 950,
        shares: 4_200,
        saves: 2_000,
        engagement_rate: 12.5,
        platform: "tiktok",
        author: "@growth",
        caption: "The simple system creators use every week",
        published_at: "2026-05-01",
        niche: "creator economy",
      },
      tags: ["viralmaxing", "tiktok", "creator economy"],
    };

    const analysis = buildDeterministicViralAnalysis(source);

    expect(analysis.payload.metrics_signal.strength).toBe("high");
    expect(analysis.payload.why_it_worked).toContain("150000");
    expect(analysis.payload.hook).toContain("creators use");
    expect(analysis.payload.format_pattern).toContain("tiktok");
    expect(analysis.priority_score).toBeGreaterThanOrEqual(80);
    expect(analysis.risk_notes).toContain("fallback");
  });

  it("detects discussion angle when comments dominate the signal", () => {
    const source: SourceForViralAnalysis = {
      id: "source-2",
      title: "Debate ref",
      source_type: "viralmaxing",
      raw_payload: {
        views: 20_000,
        likes: 600,
        comments: 1_500,
        shares: 120,
        engagement_rate: 4.2,
        platform: "x",
      },
      tags: ["viralmaxing", "x"],
    };

    const analysis = buildDeterministicViralAnalysis(source);

    expect(analysis.payload.metrics_signal.strength).toBe("medium");
    expect(analysis.payload.content_opportunities.join(" ")).toContain("discussion");
    expect(analysis.angle).toContain("discussion");
  });
});

describe("buildDeterministicIdea", () => {
  it("builds an idea from the enriched analysis payload", () => {
    const analysis: AnalysisForIdeaInput = {
      id: "analysis-1",
      source_id: "source-1",
      source_refs: ["source-1"],
      meaning: "Summary from analysis",
      hook: "Hook from analysis",
      angle: "Shareable systems angle",
      priority_score: 86,
      analysis_payload: {
        summary: "Summary from payload",
        why_it_worked: "It combined proof and a simple repeatable frame.",
        audience: "operators",
        hook: "Steal this weekly creator system",
        angle: "Show the repeatable operating system behind the result",
        format_pattern: "short_video",
        metrics_signal: {
          strength: "high",
          reason: "High engagement and shares",
        },
        content_opportunities: ["Turn it into a Telegram checklist", "Make a short video script"],
        risks: ["Avoid copying the original creator"],
      },
    };

    const idea = buildDeterministicIdea(analysis);

    expect(idea.payload.title).toContain("Steal this weekly creator system");
    expect(idea.payload.adaptation_note).toContain("High engagement");
    expect(idea.payload.outline).toEqual(
      expect.arrayContaining(["Turn it into a Telegram checklist"]),
    );
    expect(idea.source_refs).toEqual(["source-1"]);
    expect(idea.priority).toBe("high");
  });
});

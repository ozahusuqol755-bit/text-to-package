export type MetricsStrength = "low" | "medium" | "high";

export interface SourceForViralAnalysis {
  id: string;
  title: string;
  url?: string | null;
  source_type: string;
  raw_text?: string | null;
  raw_payload?: Record<string, unknown> | null;
  tags?: unknown;
}

export interface ViralAnalysisPayload {
  summary: string;
  why_it_worked: string;
  audience: string;
  hook: string;
  angle: string;
  format_pattern: string;
  metrics_signal: {
    strength: MetricsStrength;
    reason: string;
  };
  content_opportunities: string[];
  risks: string[];
}

export interface DeterministicAnalysisInput {
  meaning: string;
  hook: string;
  angle: string;
  pain: string;
  promise: string;
  cta: string;
  risk_notes: string;
  risk_status: "active";
  platform_fit: string[];
  priority_score: number;
  decision: "to_idea";
  payload: ViralAnalysisPayload;
}

export interface AnalysisForIdeaInput {
  id: string;
  source_id: string | null;
  source_refs: unknown;
  meaning: string;
  hook: string;
  angle: string;
  priority_score: number;
  analysis_payload?: Partial<ViralAnalysisPayload> | null;
}

export interface IdeaPayload {
  title: string;
  thesis: string;
  format: "telegram_post" | "short_video" | "carousel" | "thread" | "article" | "script";
  platform: "telegram" | "instagram" | "tiktok" | "youtube_shorts" | "x" | "linkedin" | "universal";
  hook: string;
  outline: string[];
  adaptation_note: string;
  risk_to_check: string;
}

export interface DeterministicIdeaInput {
  topic: string;
  angle: string;
  source_refs: string[];
  platform_targets: string[];
  priority: "low" | "medium" | "high";
  priority_score: number;
  tags: string[];
  status: "draft";
  payload: IdeaPayload;
}

function textValue(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function numberValue(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value.replace("%", "").replace(",", ".").trim());
    if (Number.isFinite(normalized)) return normalized;
  }

  return 0;
}

function normalizePayload(source: SourceForViralAnalysis): Record<string, unknown> {
  return source.raw_payload && typeof source.raw_payload === "object" ? source.raw_payload : {};
}

function sourceRefs(value: unknown, fallbackSourceId: string | null): string[] {
  if (Array.isArray(value)) {
    const refs = value.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    if (refs.length > 0) return refs;
  }

  return fallbackSourceId ? [fallbackSourceId] : [];
}

function priorityFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function platformTargets(platform: string): string[] {
  const normalized = platform.toLowerCase();

  if (normalized.includes("tiktok")) return ["tiktok", "reels"];
  if (normalized.includes("instagram")) return ["instagram", "reels"];
  if (normalized.includes("x") || normalized.includes("thread")) return ["x", "threads"];
  if (normalized.includes("vk")) return ["vk"];
  if (normalized.includes("youtube")) return ["video"];

  return ["telegram"];
}

function classifySignal(metrics: {
  views: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}): { strength: MetricsStrength; score: number; reason: string } {
  let score = 30;
  const reasons: string[] = [];

  if (metrics.views >= 100_000) {
    score += 25;
    reasons.push(`high reach: ${metrics.views} views`);
  } else if (metrics.views >= 20_000) {
    score += 15;
    reasons.push(`solid reach: ${metrics.views} views`);
  }

  if (metrics.engagementRate >= 8) {
    score += 25;
    reasons.push(`high engagement_rate: ${metrics.engagementRate}`);
  } else if (metrics.engagementRate >= 3) {
    score += 12;
    reasons.push(`medium engagement_rate: ${metrics.engagementRate}`);
  }

  if (metrics.shares >= 1_000) {
    score += 15;
    reasons.push(`many shares/reposts: ${metrics.shares}`);
  } else if (metrics.shares >= 100) {
    score += 7;
    reasons.push(`shareable signal: ${metrics.shares} shares/reposts`);
  }

  if (metrics.comments >= 500) {
    score += 10;
    reasons.push(`discussion signal: ${metrics.comments} comments`);
  }

  if (metrics.saves >= 500) {
    score += 8;
    reasons.push(`save-worthy utility: ${metrics.saves} saves`);
  }

  const cappedScore = Math.max(10, Math.min(100, score));
  const strength: MetricsStrength =
    cappedScore >= 75 ? "high" : cappedScore >= 45 ? "medium" : "low";

  return {
    strength,
    score: cappedScore,
    reason:
      reasons.length > 0 ? reasons.join("; ") : "Limited ViralMaxing signal in the imported row.",
  };
}

function firstMeaningfulText(
  source: SourceForViralAnalysis,
  payload: Record<string, unknown>,
): string {
  return (
    textValue(payload, ["caption", "caption/title", "title"]) ||
    source.raw_text?.trim() ||
    source.title ||
    source.url ||
    "Imported ViralMaxing ref"
  );
}

export function buildDeterministicViralAnalysis(
  source: SourceForViralAnalysis,
): DeterministicAnalysisInput {
  const payload = normalizePayload(source);
  const platform = textValue(payload, ["platform"]) || "unknown platform";
  const author = textValue(payload, ["author", "author/account", "account"]) || "unknown author";
  const niche = textValue(payload, ["niche", "niche/topic", "topic"]) || "general";
  const caption = firstMeaningfulText(source, payload);
  const views = numberValue(payload, "views");
  const likes = numberValue(payload, "likes");
  const comments = numberValue(payload, "comments");
  const shares = numberValue(payload, "shares");
  const saves = numberValue(payload, "saves");
  const engagementRate = numberValue(payload, "engagement_rate");
  const signal = classifySignal({ views, comments, shares, saves, engagementRate });
  const shareable = shares >= comments && shares >= 100;
  const discussion = comments > shares && comments >= 100;
  const utility = saves >= 500;
  const angleSignal = shareable
    ? "shareable angle"
    : discussion
      ? "discussion angle"
      : utility
        ? "utility/save angle"
        : "clear adaptation angle";
  const opportunities = [
    `Adapt the ${angleSignal} for our operator audience instead of copying the original.`,
    shareable
      ? "Turn the core claim into a repostable Telegram/X thread."
      : "Turn the core insight into a Telegram post with a practical operator takeaway.",
  ];

  if (discussion) opportunities.push("Use the comment tension as a controlled discussion prompt.");
  if (utility) opportunities.push("Package the save-worthy part as a checklist or carousel.");

  const analysisPayload: ViralAnalysisPayload = {
    summary: `${caption.slice(0, 180)}${caption.length > 180 ? "..." : ""}`,
    why_it_worked: `The ref from ${author} on ${platform} combined ${signal.reason}.`,
    audience: `${niche} audience on ${platform}`,
    hook: caption,
    angle: `Use the ${angleSignal}: explain why this worked and translate it into a repeatable content system.`,
    format_pattern: `${platform} ref with metrics-backed ${angleSignal}`,
    metrics_signal: {
      strength: signal.strength,
      reason: signal.reason,
    },
    content_opportunities: opportunities,
    risks: [
      "Do not copy the original structure word-for-word.",
      "Check claims and context before adapting the example.",
    ],
  };

  return {
    meaning: analysisPayload.summary,
    hook: analysisPayload.hook,
    angle: analysisPayload.angle,
    pain: `The source worked because of ${signal.reason}; blindly copying it would lose context.`,
    promise: "Adapt the winning pattern into original content with source metrics preserved.",
    cta: "Choose the strongest opportunity and generate an idea.",
    risk_notes: "AI fallback used: deterministic ViralMaxing demo-analysis.",
    risk_status: "active",
    platform_fit: platformTargets(platform),
    priority_score: signal.score,
    decision: "to_idea",
    payload: analysisPayload,
  };
}

export function buildDeterministicIdea(analysis: AnalysisForIdeaInput): DeterministicIdeaInput {
  const payload = analysis.analysis_payload ?? {};
  const hook = payload.hook || analysis.hook || "Hook from ViralMaxing ref";
  const title = `Адаптация: ${hook}`.slice(0, 120);
  const opportunities =
    Array.isArray(payload.content_opportunities) && payload.content_opportunities.length > 0
      ? payload.content_opportunities
      : ["Explain the pattern", "Adapt it for our audience", "Add a concrete next action"];
  const risk =
    Array.isArray(payload.risks) && typeof payload.risks[0] === "string"
      ? payload.risks[0]
      : "Check source context before publishing.";
  const signalReason =
    payload.metrics_signal && typeof payload.metrics_signal.reason === "string"
      ? payload.metrics_signal.reason
      : "No detailed metrics signal.";
  const platform = payload.format_pattern?.toLowerCase().includes("tiktok")
    ? "tiktok"
    : payload.format_pattern?.toLowerCase().includes("x")
      ? "x"
      : "telegram";
  const format =
    platform === "tiktok" ? "short_video" : platform === "x" ? "thread" : "telegram_post";
  const ideaPayload: IdeaPayload = {
    title,
    thesis:
      payload.why_it_worked ||
      `The ref worked because the hook and angle created a clear audience signal.`,
    format,
    platform,
    hook,
    outline: opportunities.slice(0, 5),
    adaptation_note: `Use the metrics signal as the adaptation filter: ${signalReason}`,
    risk_to_check: risk,
  };

  return {
    topic: ideaPayload.title,
    angle: payload.angle || analysis.angle,
    source_refs: sourceRefs(analysis.source_refs, analysis.source_id),
    platform_targets: [ideaPayload.platform],
    priority: priorityFromScore(analysis.priority_score),
    priority_score: analysis.priority_score,
    tags: ["generated", "analysis", "viralmaxing"],
    status: "draft",
    payload: ideaPayload,
  };
}

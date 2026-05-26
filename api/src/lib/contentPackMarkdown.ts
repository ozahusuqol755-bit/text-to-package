type JsonObject = Record<string, unknown>;

const NA = "Not available";

interface ExportPack {
  id: string;
  source_id?: string | null;
  analysis_id?: string | null;
  idea_id?: string | null;
  title?: string | null;
  platform?: string | null;
  format?: string | null;
  draft_text?: string | null;
  hooks?: unknown;
  captions?: unknown;
  visual_brief?: string | null;
  image_prompt?: string | null;
  video_script?: string | null;
  cta?: string | null;
  checklist?: unknown;
  status?: string | null;
  content_pack_payload?: unknown;
}

interface ExportSource {
  id: string;
  title?: string | null;
  url?: string | null;
  raw_payload?: JsonObject | null;
}

interface ExportAnalysis {
  id: string;
  meaning?: string | null;
  hook?: string | null;
  angle?: string | null;
  analysis_payload?: unknown;
}

interface ExportIdea {
  id: string;
  topic?: string | null;
  angle?: string | null;
  idea_payload?: unknown;
}

interface ExportAiUsage {
  task_type?: string | null;
  model_used?: string | null;
}

export interface ContentPackMarkdownInput {
  generatedAt: string;
  aiMode: "configured" | "fallback";
  pack: ExportPack;
  source?: ExportSource | null;
  analysis?: ExportAnalysis | null;
  idea?: ExportIdea | null;
  aiUsage?: ExportAiUsage | null;
}

function text(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return NA;
}

function payloadText(payload: JsonObject | null | undefined, key: string): string {
  return text(payload?.[key]);
}

function metric(payload: JsonObject | null | undefined, keys: string[]): string {
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return NA;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function bulletList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : NA;
}

function numberedList(items: string[]): string {
  return items.length > 0 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : NA;
}

function section(title: string, body: string): string {
  return `### ${title}\n${body || NA}`;
}

export function buildContentPackMarkdown(input: ContentPackMarkdownInput): string {
  const { pack, source, analysis, idea, aiUsage } = input;
  const sourcePayload = source?.raw_payload ?? {};
  const analysisPayload =
    analysis?.analysis_payload && typeof analysis.analysis_payload === "object"
      ? (analysis.analysis_payload as JsonObject)
      : {};
  const ideaPayload =
    idea?.idea_payload && typeof idea.idea_payload === "object"
      ? (idea.idea_payload as JsonObject)
      : {};
  const metricsSignal =
    analysisPayload.metrics_signal && typeof analysisPayload.metrics_signal === "object"
      ? (analysisPayload.metrics_signal as JsonObject)
      : null;

  return [
    `# Content Pack: ${text(pack.title)}`,
    "",
    "## Source / Ref",
    `- URL: ${text(source?.url)}`,
    `- Platform: ${metric(sourcePayload, ["platform"])}`,
    `- Author: ${metric(sourcePayload, ["author", "author/account", "account"])}`,
    "- Metrics:",
    `  - Views: ${metric(sourcePayload, ["views"])}`,
    `  - Likes: ${metric(sourcePayload, ["likes"])}`,
    `  - Comments: ${metric(sourcePayload, ["comments"])}`,
    `  - Shares: ${metric(sourcePayload, ["shares", "reposts", "shares/reposts"])}`,
    `  - Saves: ${metric(sourcePayload, ["saves"])}`,
    `  - Engagement rate: ${metric(sourcePayload, ["engagement_rate", "er"])}`,
    "",
    "## Analysis",
    section("Summary", payloadText(analysisPayload, "summary") || text(analysis?.meaning)),
    "",
    section("Why it worked", payloadText(analysisPayload, "why_it_worked")),
    "",
    section("Audience", payloadText(analysisPayload, "audience")),
    "",
    section("Hook", payloadText(analysisPayload, "hook") || text(analysis?.hook)),
    "",
    section("Angle", payloadText(analysisPayload, "angle") || text(analysis?.angle)),
    "",
    section("Format pattern", payloadText(analysisPayload, "format_pattern")),
    "",
    section(
      "Metrics signal",
      metricsSignal ? `${text(metricsSignal.strength)}: ${text(metricsSignal.reason)}` : NA,
    ),
    "",
    section("Opportunities", bulletList(stringArray(analysisPayload.content_opportunities))),
    "",
    section("Risks", bulletList(stringArray(analysisPayload.risks))),
    "",
    "## Idea",
    section("Title", payloadText(ideaPayload, "title") || text(idea?.topic)),
    "",
    section("Thesis", payloadText(ideaPayload, "thesis") || text(idea?.angle)),
    "",
    section("Format", payloadText(ideaPayload, "format")),
    "",
    section("Platform", payloadText(ideaPayload, "platform")),
    "",
    section("Hook", payloadText(ideaPayload, "hook")),
    "",
    section("Outline", numberedList(stringArray(ideaPayload.outline))),
    "",
    section("Adaptation note", payloadText(ideaPayload, "adaptation_note")),
    "",
    section("Risk to check", payloadText(ideaPayload, "risk_to_check")),
    "",
    "## Content Pack",
    section("Draft text", text(pack.draft_text)),
    "",
    section("Hooks", numberedList(stringArray(pack.hooks))),
    "",
    section("Captions", numberedList(stringArray(pack.captions))),
    "",
    section("Visual brief", text(pack.visual_brief)),
    "",
    section("Image prompt", text(pack.image_prompt)),
    "",
    section("Video script", text(pack.video_script)),
    "",
    section("CTA", text(pack.cta)),
    "",
    section("Checklist", bulletList(stringArray(pack.checklist))),
    "",
    "## Review",
    `Status: ${text(pack.status)}`,
    "",
    "## Meta",
    `Generated at: ${input.generatedAt}`,
    `Model used: ${text(aiUsage?.model_used)}`,
    `Task type: ${text(aiUsage?.task_type)}`,
    `AI mode: ${input.aiMode}`,
    `Source id: ${text(pack.source_id)}`,
    `Analysis id: ${text(pack.analysis_id)}`,
    `Idea id: ${text(pack.idea_id)}`,
    `Pack id: ${text(pack.id)}`,
    "",
  ].join("\n");
}

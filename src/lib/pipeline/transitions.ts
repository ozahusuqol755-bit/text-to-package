/**
 * Pure business-logic transitions for the content pipeline.
 *
 * These functions are framework-agnostic: they take current entities (or
 * input data) and return new entities / patches. They DO NOT mutate state,
 * dispatch actions, call APIs, or touch React.
 *
 * The store (src/store/PipelineStore.tsx) wires them to a reducer.
 * When backend is connected, the same functions can be reused on the server
 * (Postgres writes / n8n triggers) — only the persistence layer changes.
 */

import type {
  Analysis,
  AssetFormat,
  ContentAsset,
  ContentPack,
  Idea,
  Metric,
  Platform,
  PublishJob,
  ReviewCheck,
  Source,
} from "@/types/pipeline";

// ── id helper ────────────────────────────────────────────────────────────
export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── platform helpers ─────────────────────────────────────────────────────
export const ALL_PLATFORMS: Platform[] = [
  "telegram", "threads", "x", "vk", "instagram", "reels", "tiktok", "image", "video",
];

export function formatForPlatform(p: Platform): AssetFormat {
  if (p === "image") return "image_prompt";
  if (p === "video") return "video_brief";
  if (p === "instagram") return "caption";
  if (p === "reels" || p === "tiktok") return "script";
  return "post";
}

export function platformDraft(
  p: Platform,
  topic: string,
  angle: string,
): Partial<ContentAsset> {
  const base = `${topic}. Угол: ${angle}.`;
  if (p === "image")
    return { image_prompt: `Иллюстрация к теме: ${topic}. Стиль Telegram Mini App, тёмный фон, акцент на approve.` };
  if (p === "video")
    return { video_prompt: `Видео-бриф: 30 сек, динамичный монтаж. Тезис: ${topic}. Финал — кнопка Approve.` };
  if (p === "telegram")
    return { text: `📡 ${topic}\n\n${angle}\n\nКонтент-завод К/З: AI готовит, редактор одобряет.` };
  if (p === "x") return { text: `${topic} — ${angle}. Approve stays human.` };
  if (p === "threads") return { text: `${topic}. ${angle}. Где у вас approve gate?` };
  if (p === "vk") return { text: `${topic}.\n\n${angle}. Подробнее — в нашем канале.` };
  if (p === "instagram") return { text: `${topic} ✨\n\n${angle}` };
  return { text: base };
}

// ── SOURCES ──────────────────────────────────────────────────────────────
/** Mock parsing: fills raw_text / summary / hooks / cta / format / risk. */
export function parseSource(src: Source): Partial<Source> {
  const mockRisk: Source["source_risk"] =
    src.source_type === "competitor" ? "medium" : "low";
  const mockFormat =
    src.source_type === "video" ? "video" :
    src.source_type === "screenshot" ? "image" : "post";
  return {
    status: "parsed",
    raw_text: `[parsed] полный текст по «${src.title}» (~${Math.floor(Math.random() * 4000 + 800)} симв.)`,
    summary: src.summary ?? `Краткая выжимка: главное про «${src.title}» и почему это интересно.`,
    hooks:
      src.hooks && src.hooks.length
        ? src.hooks
        : [`Хук: ${src.title.slice(0, 32)}`, "Хук: применимо к нашему сегменту"],
    cta: src.cta ?? "Подписаться на канал",
    format: src.format ?? mockFormat,
    source_risk: src.source_risk ?? mockRisk,
    tags: src.tags.length ? src.tags : [src.source_type],
  };
}

// ── ANALYSIS ─────────────────────────────────────────────────────────────
export function buildAnalysisFromSource(src: Source): Analysis {
  return {
    id: uid("an"),
    source_id: src.id,
    source_refs: [src.id],
    meaning: src.summary ?? `Смысл из «${src.title}»`,
    hook: src.hooks?.[0] ?? "—",
    angle: "Угол под нашу аудиторию",
    pain: "Боль аудитории по теме",
    promise: "Что мы обещаем",
    cta: src.cta ?? "—",
    risk_notes: src.source_risk === "high" ? "Высокий риск копирования" : "—",
    risk_status: "active",
    platform_fit: ["telegram", "threads"],
    priority_score: Math.floor(Math.random() * 4) + 6,
    decision: "to_idea",
    created_at: new Date().toISOString(),
  };
}

// ── IDEAS ────────────────────────────────────────────────────────────────
export function buildIdeaFromAnalysis(a: Analysis): Idea {
  const priority: Idea["priority"] =
    a.priority_score >= 8 ? "high" : a.priority_score >= 5 ? "medium" : "low";
  return {
    id: uid("idea"),
    topic: a.hook && a.hook !== "—" ? a.hook : a.meaning,
    angle: a.angle,
    source_refs: a.source_refs,
    platform_targets: a.platform_fit.length ? a.platform_fit : ["telegram", "threads", "x"],
    priority,
    priority_score: a.priority_score,
    tags: ["from_analysis"],
    status: "draft",
    created_at: new Date().toISOString(),
  };
}

// ── PACKS / ASSETS / CHECKS ──────────────────────────────────────────────
export interface BuiltPack {
  pack: ContentPack;
  assets: ContentAsset[];
  checks: ReviewCheck[];
}

export function buildPackFromIdea(idea: Idea): BuiltPack {
  const packId = uid("pack");
  const pack: ContentPack = {
    id: packId,
    idea_id: idea.id,
    title: `Пакет: ${idea.topic.slice(0, 48)}`,
    status: "draft",
    created_at: new Date().toISOString(),
  };
  const platforms = idea.platform_targets.length ? idea.platform_targets : ALL_PLATFORMS;
  const assets: ContentAsset[] = platforms.map((p) => ({
    id: uid("as"),
    pack_id: packId,
    platform: p,
    format: formatForPlatform(p),
    source_refs: idea.source_refs,
    status: "draft",
    version: 1,
    qc_score: Math.floor(Math.random() * 15) + 75,
    ...platformDraft(p, idea.topic, idea.angle),
  }));
  const checks: ReviewCheck[] = [
    { id: uid("rc"), pack_id: packId, label: "Смысл не скопирован",      required: true,  passed: false },
    { id: uid("rc"), pack_id: packId, label: "Тон бренда подходит",      required: true,  passed: false },
    { id: uid("rc"), pack_id: packId, label: "Платформы адаптированы",   required: true,  passed: false },
    { id: uid("rc"), pack_id: packId, label: "Факты проверены",          required: true,  passed: false },
    { id: uid("rc"), pack_id: packId, label: "CTA на месте",             required: false, passed: false },
    { id: uid("rc"), pack_id: packId, label: "Риск копирования низкий", required: true,  passed: false },
  ];
  return { pack, assets, checks };
}

/** Returns a patch that bumps version and re-marks asset as rewrite_requested. */
export function bumpAssetVersion(a: ContentAsset): Partial<ContentAsset> {
  const nextVersion = a.version + 1;
  const prefix = `[v${nextVersion}] `;
  const patch: Partial<ContentAsset> = {
    version: nextVersion,
    status: "rewrite_requested",
  };
  if (a.text !== undefined) patch.text = prefix + (a.text ?? "");
  if (a.image_prompt !== undefined) patch.image_prompt = prefix + (a.image_prompt ?? "");
  if (a.video_prompt !== undefined) patch.video_prompt = prefix + (a.video_prompt ?? "");
  return patch;
}

// ── REVIEW GATES ─────────────────────────────────────────────────────────
/** Approve-gate: all REQUIRED checks must be passed and at least one check exists. */
export function canApprovePack(checks: ReviewCheck[], packId: string): boolean {
  const ck = checks.filter((c) => c.pack_id === packId);
  if (ck.length === 0) return false;
  return ck.filter((c) => c.required).every((c) => c.passed);
}

// ── PUBLISH GATE (HARD RULE) ─────────────────────────────────────────────
/**
 * Hard rule for publish — checked in BOTH UI and store:
 *   pack.status === "approved" AND approved_by AND approved_at.
 * Same rule will be enforced server-side once backend is wired.
 */
export function canPublishPack(pack: ContentPack | undefined): boolean {
  if (!pack) return false;
  return (
    pack.status === "approved" &&
    Boolean(pack.approved_by) &&
    Boolean(pack.approved_at)
  );
}

export function buildPublishJobs(
  pack: ContentPack,
  assets: ContentAsset[],
): PublishJob[] {
  return assets
    .filter((a) => a.pack_id === pack.id)
    .map((a) => ({
      id: uid("job"),
      pack_id: pack.id,
      asset_id: a.id,
      platform: a.platform,
      tool: a.platform === "telegram" ? "Telegram Bot" : "DOHOO",
      status: "publishing",
      scheduled_at: new Date().toISOString(),
      attempts: 1,
    }));
}

export function buildMetricsForPack(pack: ContentPack, jobs: PublishJob[]): Metric[] {
  return jobs.map((j) => ({
    id: uid("m"),
    pack_id: pack.id,
    platform: j.platform,
    views: Math.floor(Math.random() * 5000) + 200,
    likes: Math.floor(Math.random() * 400),
    comments: Math.floor(Math.random() * 60),
    shares: Math.floor(Math.random() * 30),
    saves: Math.floor(Math.random() * 40),
    ctr: +(Math.random() * 8).toFixed(1),
    er: +(Math.random() * 10).toFixed(1),
    conclusion: "Новый сигнал готов к анализу",
  }));
}

// ── METRICS → ANALYSIS LOOP ──────────────────────────────────────────────
export function buildAnalysisFromMetric(m: Metric): Analysis {
  return {
    id: uid("an"),
    source_id: m.pack_id,
    source_refs: [m.pack_id],
    meaning: `Сигнал из метрик: ${m.platform} · views ${m.views} · ER ${m.er}%`,
    hook: m.conclusion ?? `Что зашло на ${m.platform}`,
    angle: "Повторить успешный паттерн",
    pain: "Нужно стабильно повторять рост",
    promise: "Серия по тому же углу",
    cta: "Запустить продолжение",
    risk_notes: m.errors ?? "—",
    risk_status: "active",
    platform_fit: [m.platform],
    priority_score: m.er >= 5 ? 9 : 6,
    decision: "to_idea",
    created_at: new Date().toISOString(),
  };
}

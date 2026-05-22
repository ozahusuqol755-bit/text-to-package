import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  Analysis,
  AnalysisDecision,
  AnalysisRiskStatus,
  AssetStatus,
  ContentAsset,
  ContentPack,
  Idea,
  IdeaStatus,
  LogEvent,
  Metric,
  PackStatus,
  Platform,
  PublishJob,
  PublishStatus,
  ReviewCheck,
  Source,
  SourceStatus,
  SourceType,
  Tool,
} from "@/types/pipeline";
import {
  mockAnalyses,
  mockAssets,
  mockIdeas,
  mockLogs,
  mockMetrics,
  mockPacks,
  mockPublishJobs,
  mockReviewChecks,
  mockSources,
  mockTools,
} from "@/data/mockData";

const OPERATOR = "@operator_kz";
const EDITOR = "@editor_kz";

interface State {
  sources: Source[];
  analyses: Analysis[];
  ideas: Idea[];
  packs: ContentPack[];
  assets: ContentAsset[];
  reviewChecks: ReviewCheck[];
  publishJobs: PublishJob[];
  metrics: Metric[];
  tools: Tool[];
  logs: LogEvent[];
}

const initialState: State = {
  sources: mockSources,
  analyses: mockAnalyses,
  ideas: mockIdeas,
  packs: mockPacks,
  assets: mockAssets,
  reviewChecks: mockReviewChecks,
  publishJobs: mockPublishJobs,
  metrics: mockMetrics,
  tools: mockTools,
  logs: mockLogs,
};

type Action =
  | { type: "ADD_SOURCE"; payload: Source }
  | { type: "PATCH_SOURCE"; id: string; patch: Partial<Source> }
  | { type: "ADD_ANALYSIS"; payload: Analysis }
  | { type: "PATCH_ANALYSIS"; id: string; patch: Partial<Analysis> }
  | { type: "ADD_IDEA"; payload: Idea }
  | { type: "PATCH_IDEA"; id: string; patch: Partial<Idea> }
  | { type: "ADD_PACK"; payload: ContentPack }
  | { type: "PATCH_PACK"; id: string; patch: Partial<ContentPack> }
  | { type: "ADD_ASSETS"; payload: ContentAsset[] }
  | { type: "PATCH_ASSET"; id: string; patch: Partial<ContentAsset> }
  | { type: "ADD_CHECKS"; payload: ReviewCheck[] }
  | { type: "PATCH_CHECK"; id: string; patch: Partial<ReviewCheck> }
  | { type: "ADD_PUBLISH_JOBS"; payload: PublishJob[] }
  | { type: "PATCH_PUBLISH_JOB"; id: string; patch: Partial<PublishJob> }
  | { type: "ADD_METRICS"; payload: Metric[] }
  | { type: "PATCH_METRIC"; id: string; patch: Partial<Metric> }
  | { type: "LOG"; payload: LogEvent };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_SOURCE": return { ...state, sources: [action.payload, ...state.sources] };
    case "PATCH_SOURCE": return { ...state, sources: state.sources.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_ANALYSIS": return { ...state, analyses: [action.payload, ...state.analyses] };
    case "PATCH_ANALYSIS": return { ...state, analyses: state.analyses.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_IDEA": return { ...state, ideas: [action.payload, ...state.ideas] };
    case "PATCH_IDEA": return { ...state, ideas: state.ideas.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_PACK": return { ...state, packs: [action.payload, ...state.packs] };
    case "PATCH_PACK": return { ...state, packs: state.packs.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_ASSETS": return { ...state, assets: [...action.payload, ...state.assets] };
    case "PATCH_ASSET": return { ...state, assets: state.assets.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_CHECKS": return { ...state, reviewChecks: [...state.reviewChecks, ...action.payload] };
    case "PATCH_CHECK": return { ...state, reviewChecks: state.reviewChecks.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_PUBLISH_JOBS": return { ...state, publishJobs: [...action.payload, ...state.publishJobs] };
    case "PATCH_PUBLISH_JOB": return { ...state, publishJobs: state.publishJobs.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_METRICS": return { ...state, metrics: [...action.payload, ...state.metrics] };
    case "PATCH_METRIC": return { ...state, metrics: state.metrics.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "LOG": return { ...state, logs: [action.payload, ...state.logs].slice(0, 300) };
    default: return state;
  }
}

interface ContextValue extends State {
  // sources
  addSource: (input: { title: string; url?: string; source_type: SourceType; tags: string[] }) => void;
  parseSource: (id: string) => void;
  rejectSource: (id: string) => void;
  sendSourceToAnalysis: (id: string) => void;
  // analysis
  createIdeaFromAnalysis: (analysisId: string) => string | null;
  archiveAnalysis: (analysisId: string) => void;
  stopAnalysis: (analysisId: string) => void;
  // ideas
  acceptIdea: (id: string) => void;
  rejectIdea: (id: string) => void;
  buildPackFromIdea: (ideaId: string) => string | null;
  // packs
  requestRewriteAsset: (assetId: string) => void;
  submitPackForReview: (packId: string) => void;
  requestRewrite: (packId: string) => void;
  rejectPack: (packId: string) => void;
  approvePack: (packId: string, approver?: string) => void;
  updateAssetText: (assetId: string, text: string) => void;
  // review
  toggleCheck: (checkId: string) => void;
  canApprove: (packId: string) => boolean;
  // publish
  publishPack: (packId: string) => void;
  retryPublishJob: (jobId: string) => void;
  canPublish: (packId: string) => boolean;
  // metrics
  signalMetricToAnalysis: (metricId: string) => void;
  // logs
  log: (e: Omit<LogEvent, "id" | "ts">) => void;
}

const PipelineContext = createContext<ContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const ALL_PLATFORMS: Platform[] = ["telegram", "threads", "x", "vk", "instagram", "reels", "tiktok", "image", "video"];

function formatForPlatform(p: Platform): ContentAsset["format"] {
  if (p === "image") return "image_prompt";
  if (p === "video") return "video_brief";
  if (p === "instagram") return "caption";
  if (p === "reels" || p === "tiktok") return "script";
  return "post";
}

function platformDraft(p: Platform, topic: string, angle: string): Partial<ContentAsset> {
  const base = `${topic}. Угол: ${angle}.`;
  if (p === "image") return { image_prompt: `Иллюстрация к теме: ${topic}. Стиль Telegram Mini App, тёмный фон, акцент на approve.` };
  if (p === "video") return { video_prompt: `Видео-бриф: 30 сек, динамичный монтаж. Тезис: ${topic}. Финал — кнопка Approve.` };
  if (p === "telegram") return { text: `📡 ${topic}\n\n${angle}\n\nКонтент-завод К/З: AI готовит, редактор одобряет.` };
  if (p === "x") return { text: `${topic} — ${angle}. Approve stays human.` };
  if (p === "threads") return { text: `${topic}. ${angle}. Где у вас approve gate?` };
  if (p === "vk") return { text: `${topic}.\n\n${angle}. Подробнее — в нашем канале.` };
  if (p === "instagram") return { text: `${topic} ✨\n\n${angle}` };
  return { text: base };
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<ContextValue>(() => {
    const log = (e: Omit<LogEvent, "id" | "ts">) =>
      dispatch({
        type: "LOG",
        payload: { id: uid("log"), ts: new Date().toISOString(), actor: OPERATOR, ...e },
      });

    // ── SOURCES ───────────────────────────────────────────────────────
    const addSource: ContextValue["addSource"] = (input) => {
      const src: Source = {
        id: uid("src"),
        title: input.title,
        url: input.url,
        source_type: input.source_type,
        tags: input.tags,
        status: "new",
        created_at: new Date().toISOString(),
      };
      dispatch({ type: "ADD_SOURCE", payload: src });
      log({ stage: "sources", action: "add_source", entity_id: src.id, message: `Добавлен источник: ${src.title}`, level: "info" });
    };

    const parseSource = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      if (!src) return;
      const baseTitle = src.title;
      const mockRisk: Source["source_risk"] = src.source_type === "competitor" ? "medium" : "low";
      const mockFormat = src.source_type === "video" ? "video" : src.source_type === "screenshot" ? "image" : "post";
      const patch: Partial<Source> = {
        status: "parsed",
        raw_text: `[parsed] полный текст по «${baseTitle}» (~${Math.floor(Math.random() * 4000 + 800)} симв.)`,
        summary: src.summary ?? `Краткая выжимка: главное про «${baseTitle}» и почему это интересно.`,
        hooks: src.hooks && src.hooks.length ? src.hooks : [`Хук: ${baseTitle.slice(0, 32)}`, "Хук: применимо к нашему сегменту"],
        cta: src.cta ?? "Подписаться на канал",
        format: src.format ?? mockFormat,
        source_risk: src.source_risk ?? mockRisk,
        tags: src.tags.length ? src.tags : [src.source_type],
      };
      dispatch({ type: "PATCH_SOURCE", id, patch });
      log({ stage: "sources", action: "parse", entity_id: id, message: `Источник ${id} распарсен`, level: "success" });
    };

    const rejectSource = (id: string) => {
      dispatch({ type: "PATCH_SOURCE", id, patch: { status: "rejected" } });
      log({ stage: "sources", action: "reject", entity_id: id, message: `Источник ${id} отклонён`, level: "warn" });
    };

    const sendSourceToAnalysis = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      if (!src) return;
      dispatch({ type: "PATCH_SOURCE", id, patch: { status: "ready_for_analysis" } });
      const analysis: Analysis = {
        id: uid("an"),
        source_id: id,
        source_refs: [id],
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
      dispatch({ type: "ADD_ANALYSIS", payload: analysis });
      log({ stage: "sources", action: "to_analysis", entity_id: id, message: `Источник ${id} → анализ ${analysis.id}`, level: "info" });
    };

    // ── ANALYSIS ──────────────────────────────────────────────────────
    const createIdeaFromAnalysis: ContextValue["createIdeaFromAnalysis"] = (analysisId) => {
      const a = state.analyses.find((x) => x.id === analysisId);
      if (!a) return null;
      const priorityLabel: Idea["priority"] = a.priority_score >= 8 ? "high" : a.priority_score >= 5 ? "medium" : "low";
      const idea: Idea = {
        id: uid("idea"),
        topic: a.hook && a.hook !== "—" ? a.hook : a.meaning,
        angle: a.angle,
        source_refs: a.source_refs,
        platform_targets: a.platform_fit.length ? a.platform_fit : ["telegram", "threads", "x"],
        priority: priorityLabel,
        priority_score: a.priority_score,
        tags: ["from_analysis"],
        status: "draft",
        created_at: new Date().toISOString(),
      };
      dispatch({ type: "ADD_IDEA", payload: idea });
      dispatch({ type: "PATCH_ANALYSIS", id: analysisId, patch: { decision: "to_idea" } });
      log({ stage: "analysis", action: "create_idea", entity_id: analysisId, message: `Из анализа ${analysisId} создана идея ${idea.id}`, level: "success" });
      return idea.id;
    };

    const archiveAnalysis = (analysisId: string) => {
      dispatch({ type: "PATCH_ANALYSIS", id: analysisId, patch: { decision: "archive", risk_status: "archived" } });
      log({ stage: "analysis", action: "archive", entity_id: analysisId, message: `Анализ ${analysisId} в архив`, level: "info" });
    };

    const stopAnalysis = (analysisId: string) => {
      dispatch({ type: "PATCH_ANALYSIS", id: analysisId, patch: { decision: "stop", risk_status: "stopped" } });
      log({ stage: "analysis", action: "stop", entity_id: analysisId, message: `Анализ ${analysisId} остановлен (risk_status=stopped)`, level: "warn" });
    };

    // ── IDEAS ─────────────────────────────────────────────────────────
    const acceptIdea = (id: string) => {
      dispatch({ type: "PATCH_IDEA", id, patch: { status: "accepted" } });
      log({ stage: "ideas", action: "accept", entity_id: id, message: `Идея ${id} принята`, level: "success" });
    };
    const rejectIdea = (id: string) => {
      dispatch({ type: "PATCH_IDEA", id, patch: { status: "rejected" } });
      log({ stage: "ideas", action: "reject", entity_id: id, message: `Идея ${id} отклонена`, level: "warn" });
    };

    const buildPackFromIdea: ContextValue["buildPackFromIdea"] = (ideaId) => {
      const idea = state.ideas.find((i) => i.id === ideaId);
      if (!idea) return null;
      const existing = state.packs.find((p) => p.idea_id === ideaId);
      if (existing) {
        log({ stage: "packs", action: "build_pack", entity_id: existing.id, message: `Пакет для идеи ${ideaId} уже существует (${existing.id})`, level: "info" });
        return existing.id;
      }
      const packId = uid("pack");
      const pack: ContentPack = {
        id: packId,
        idea_id: ideaId,
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
        { id: uid("rc"), pack_id: packId, label: "Смысл не скопирован", required: true, passed: false },
        { id: uid("rc"), pack_id: packId, label: "Тон бренда подходит", required: true, passed: false },
        { id: uid("rc"), pack_id: packId, label: "Платформы адаптированы", required: true, passed: false },
        { id: uid("rc"), pack_id: packId, label: "Факты проверены", required: true, passed: false },
        { id: uid("rc"), pack_id: packId, label: "CTA на месте", required: false, passed: false },
        { id: uid("rc"), pack_id: packId, label: "Риск копирования низкий", required: true, passed: false },
      ];
      dispatch({ type: "ADD_PACK", payload: pack });
      dispatch({ type: "ADD_ASSETS", payload: assets });
      dispatch({ type: "ADD_CHECKS", payload: checks });
      dispatch({ type: "PATCH_IDEA", id: ideaId, patch: { status: "in_pack" } });
      log({ stage: "packs", action: "build_pack", entity_id: packId, message: `Собран контент-пакет ${packId} (${assets.length} ассетов)`, level: "success" });
      return packId;
    };

    // ── PACKS / ASSETS ────────────────────────────────────────────────
    const requestRewriteAsset = (assetId: string) => {
      const a = state.assets.find((x) => x.id === assetId);
      if (!a) return;
      const nextVersion = a.version + 1;
      const prefix = `[v${nextVersion}] `;
      const patch: Partial<ContentAsset> = {
        version: nextVersion,
        status: "rewrite_requested",
      };
      if (a.text !== undefined) patch.text = prefix + (a.text ?? "");
      if (a.image_prompt !== undefined) patch.image_prompt = prefix + (a.image_prompt ?? "");
      if (a.video_prompt !== undefined) patch.video_prompt = prefix + (a.video_prompt ?? "");
      dispatch({ type: "PATCH_ASSET", id: assetId, patch });
      log({ stage: "packs", action: "rewrite_asset", entity_id: assetId, message: `Ассет ${assetId} → версия v${nextVersion}`, level: "info" });
    };

    const submitPackForReview = (packId: string) => {
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "ready_for_review" } });
      state.assets.filter((a) => a.pack_id === packId).forEach((a) =>
        dispatch({ type: "PATCH_ASSET", id: a.id, patch: { status: "ready_for_review" as AssetStatus } }),
      );
      log({ stage: "packs", action: "to_review", entity_id: packId, message: `Пакет ${packId} → на проверку`, level: "info" });
    };

    const requestRewrite = (packId: string) => {
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "rewrite_requested" as PackStatus } });
      log({ stage: "review", action: "rewrite", entity_id: packId, message: `Запрошен rewrite пакета ${packId}`, level: "warn" });
    };
    const rejectPack = (packId: string) => {
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "rejected" as PackStatus } });
      log({ stage: "review", action: "reject", entity_id: packId, message: `Пакет ${packId} отклонён`, level: "error" });
    };
    const approvePack = (packId: string, approver = EDITOR) => {
      if (!canApprove(packId)) {
        log({ stage: "review", action: "approve_blocked", entity_id: packId, message: `Approve заблокирован: не все обязательные пункты checklist отмечены`, level: "error" });
        return;
      }
      dispatch({
        type: "PATCH_PACK",
        id: packId,
        patch: {
          status: "approved",
          approved_by: approver,
          approved_at: new Date().toISOString(),
        },
      });
      state.assets.filter((a) => a.pack_id === packId).forEach((a) =>
        dispatch({ type: "PATCH_ASSET", id: a.id, patch: { status: "approved" as AssetStatus } }),
      );
      log({ stage: "review", action: "approve", entity_id: packId, actor: approver, message: `Пакет ${packId} одобрен (${approver})`, level: "success" });
    };
    const updateAssetText: ContextValue["updateAssetText"] = (assetId, text) => {
      const a = state.assets.find((x) => x.id === assetId);
      if (!a) return;
      const patch: Partial<ContentAsset> =
        a.image_prompt !== undefined ? { image_prompt: text } :
        a.video_prompt !== undefined ? { video_prompt: text } :
        { text };
      dispatch({ type: "PATCH_ASSET", id: assetId, patch });
    };

    // ── REVIEW ────────────────────────────────────────────────────────
    const toggleCheck = (checkId: string) => {
      const c = state.reviewChecks.find((x) => x.id === checkId);
      if (!c) return;
      dispatch({ type: "PATCH_CHECK", id: checkId, patch: { passed: !c.passed } });
      log({ stage: "review", action: "toggle_check", entity_id: checkId, message: `Чек «${c.label}»: ${!c.passed ? "✓" : "✗"}`, level: "info" });
    };
    const canApprove = (packId: string) => {
      const checks = state.reviewChecks.filter((c) => c.pack_id === packId);
      if (checks.length === 0) return false;
      return checks.filter((c) => c.required).every((c) => c.passed);
    };

    // ── PUBLISH ───────────────────────────────────────────────────────
    const canPublish = (packId: string) => {
      const pack = state.packs.find((p) => p.id === packId);
      return Boolean(pack && pack.status === "approved" && pack.approved_by);
    };

    const publishPack = (packId: string) => {
      if (!canPublish(packId)) {
        log({ stage: "publish", action: "publish_blocked", entity_id: packId, message: `Блок: нельзя публиковать пакет ${packId} без approve`, level: "error" });
        return;
      }
      const assets = state.assets.filter((a) => a.pack_id === packId);
      const jobs: PublishJob[] = assets.map((a, idx) => ({
        id: uid("job"),
        pack_id: packId,
        asset_id: a.id,
        platform: a.platform,
        tool: a.platform === "telegram" ? "Telegram Bot" : "DOHOO",
        status: "publishing",
        scheduled_at: new Date().toISOString(),
        attempts: 1,
        // make one job fail to demo retry
        error: idx === assets.length - 1 ? undefined : undefined,
      }));
      dispatch({ type: "ADD_PUBLISH_JOBS", payload: jobs });
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "publishing" as PackStatus } });
      log({ stage: "publish", action: "schedule", entity_id: packId, message: `Запущено ${jobs.length} job через n8n/DOHOO`, level: "info" });

      // simulate publishing
      window.setTimeout(() => {
        const failIdx = Math.floor(Math.random() * jobs.length);
        jobs.forEach((j, idx) => {
          if (idx === failIdx && jobs.length > 1) {
            dispatch({ type: "PATCH_PUBLISH_JOB", id: j.id, patch: { status: "failed" as PublishStatus, error: "API timeout" } });
            log({ stage: "publish", action: "fail", entity_id: j.id, message: `Job ${j.id} (${j.platform}) failed: API timeout`, level: "error" });
          } else {
            dispatch({ type: "PATCH_PUBLISH_JOB", id: j.id, patch: { status: "published" as PublishStatus, published_at: new Date().toISOString() } });
          }
        });
        const allOk = jobs.length === 1;
        dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "published" as PackStatus } });
        // create mock metrics
        const metrics: Metric[] = jobs.map((j) => ({
          id: uid("m"),
          pack_id: packId,
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
        dispatch({ type: "ADD_METRICS", payload: metrics });
        log({ stage: "publish", action: "publish", entity_id: packId, message: `Пакет ${packId} опубликован${allOk ? "" : " (часть с ошибками — нужен retry)"}`, level: allOk ? "success" : "warn" });
      }, 1400);
    };

    const retryPublishJob = (jobId: string) => {
      const j = state.publishJobs.find((x) => x.id === jobId);
      if (!j) return;
      dispatch({ type: "PATCH_PUBLISH_JOB", id: jobId, patch: { status: "publishing" as PublishStatus, error: undefined, attempts: j.attempts + 1 } });
      log({ stage: "publish", action: "retry", entity_id: jobId, message: `Retry job ${jobId} (попытка ${j.attempts + 1})`, level: "info" });
      window.setTimeout(() => {
        dispatch({ type: "PATCH_PUBLISH_JOB", id: jobId, patch: { status: "published" as PublishStatus, published_at: new Date().toISOString() } });
        log({ stage: "publish", action: "publish", entity_id: jobId, message: `Job ${jobId} опубликован после retry`, level: "success" });
      }, 1000);
    };

    // ── METRICS ───────────────────────────────────────────────────────
    const signalMetricToAnalysis = (metricId: string) => {
      const m = state.metrics.find((x) => x.id === metricId);
      if (!m) return;
      const analysis: Analysis = {
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
        platform_fit: [m.platform as Platform],
        priority_score: m.er >= 5 ? 9 : 6,
        decision: "to_idea",
        created_at: new Date().toISOString(),
      };
      dispatch({ type: "ADD_ANALYSIS", payload: analysis });
      dispatch({ type: "PATCH_METRIC", id: metricId, patch: { signaled: true } });
      log({ stage: "metrics", action: "signal_to_analysis", entity_id: metricId, message: `Сигнал из метрик ${metricId} отправлен в анализ (${analysis.id})`, level: "success" });
    };

    return {
      ...state,
      addSource, parseSource, rejectSource, sendSourceToAnalysis,
      createIdeaFromAnalysis, archiveAnalysis, stopAnalysis,
      acceptIdea, rejectIdea, buildPackFromIdea,
      requestRewriteAsset, submitPackForReview, requestRewrite, rejectPack, approvePack, updateAssetText,
      toggleCheck, canApprove,
      publishPack, retryPublishJob, canPublish,
      signalMetricToAnalysis,
      log,
    };
  }, [state]);

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  Analysis,
  AssetStatus,
  ContentAsset,
  ContentPack,
  Idea,
  LogEvent,
  Metric,
  PackStatus,
  PublishJob,
  PublishStatus,
  ReviewCheck,
  Source,
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
import {
  buildAnalysisFromMetric,
  buildAnalysisFromSource,
  buildIdeaFromAnalysis,
  buildMetricsForPack,
  buildPackFromIdea,
  buildPublishJobs,
  bumpAssetVersion,
  canApprovePack,
  canPublishPack,
  parseSource as parseSourcePure,
  uid,
} from "@/lib/pipeline/transitions";

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
    case "ADD_SOURCE":        return { ...state, sources: [action.payload, ...state.sources] };
    case "PATCH_SOURCE":      return { ...state, sources: state.sources.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_ANALYSIS":      return { ...state, analyses: [action.payload, ...state.analyses] };
    case "PATCH_ANALYSIS":    return { ...state, analyses: state.analyses.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_IDEA":          return { ...state, ideas: [action.payload, ...state.ideas] };
    case "PATCH_IDEA":        return { ...state, ideas: state.ideas.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_PACK":          return { ...state, packs: [action.payload, ...state.packs] };
    case "PATCH_PACK":        return { ...state, packs: state.packs.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_ASSETS":        return { ...state, assets: [...action.payload, ...state.assets] };
    case "PATCH_ASSET":       return { ...state, assets: state.assets.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_CHECKS":        return { ...state, reviewChecks: [...state.reviewChecks, ...action.payload] };
    case "PATCH_CHECK":       return { ...state, reviewChecks: state.reviewChecks.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_PUBLISH_JOBS":  return { ...state, publishJobs: [...action.payload, ...state.publishJobs] };
    case "PATCH_PUBLISH_JOB": return { ...state, publishJobs: state.publishJobs.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "ADD_METRICS":       return { ...state, metrics: [...action.payload, ...state.metrics] };
    case "PATCH_METRIC":      return { ...state, metrics: state.metrics.map((x) => x.id === action.id ? { ...x, ...action.patch } : x) };
    case "LOG":               return { ...state, logs: [action.payload, ...state.logs].slice(0, 300) };
    default:                  return state;
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
  createContentPackFromIdea: (ideaId: string) => string | null;
  /** @deprecated alias of createContentPackFromIdea */
  buildPackFromIdea: (ideaId: string) => string | null;
  // packs
  requestAssetRewrite: (assetId: string) => void;
  /** @deprecated alias of requestAssetRewrite */
  requestRewriteAsset: (assetId: string) => void;
  sendPackToReview: (packId: string) => void;
  /** @deprecated alias of sendPackToReview */
  submitPackForReview: (packId: string) => void;
  requestPackRewrite: (packId: string) => void;
  /** @deprecated alias of requestPackRewrite */
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
  createAnalysisSignalFromMetrics: (metricId: string) => void;
  /** @deprecated alias of createAnalysisSignalFromMetrics */
  signalMetricToAnalysis: (metricId: string) => void;
  // logs
  log: (e: Omit<LogEvent, "id" | "ts">) => void;
}

const PipelineContext = createContext<ContextValue | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<ContextValue>(() => {
    const LEVEL_TO_RESULT = { success: "success", info: "success", warn: "warning", error: "error" } as const;
    const log = (e: Omit<LogEvent, "id" | "ts" | "result"> & { result?: LogEvent["result"] }) =>
      dispatch({
        type: "LOG",
        payload: {
          id: uid("log"),
          ts: new Date().toISOString(),
          actor: OPERATOR,
          ...e,
          result: e.result ?? LEVEL_TO_RESULT[e.level],
        },
      });

    // ── SOURCES ─────────────────────────────────────────────────────
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
      log({ stage: "sources", action: "add_source", entity_type: "source", entity_id: src.id, status_after: "new", message: `Добавлен источник: ${src.title}`, level: "info" });
    };

    const parseSource = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      if (!src) return;
      const patch = parseSourcePure(src);
      dispatch({ type: "PATCH_SOURCE", id, patch });
      log({ stage: "sources", action: "parse", entity_type: "source", entity_id: id, status_before: src.status, status_after: patch.status ?? "parsed", message: `Источник ${id} распарсен`, level: "success" });
    };

    const rejectSource = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      dispatch({ type: "PATCH_SOURCE", id, patch: { status: "rejected" } });
      log({ stage: "sources", action: "reject", entity_type: "source", entity_id: id, status_before: src?.status, status_after: "rejected", message: `Источник ${id} отклонён`, level: "warn" });
    };

    const sendSourceToAnalysis = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      if (!src) return;
      dispatch({ type: "PATCH_SOURCE", id, patch: { status: "ready_for_analysis" } });
      const analysis = buildAnalysisFromSource(src);
      dispatch({ type: "ADD_ANALYSIS", payload: analysis });
      log({ stage: "sources", action: "to_analysis", entity_type: "source", entity_id: id, status_before: src.status, status_after: "ready_for_analysis", message: `Источник ${id} → анализ ${analysis.id}`, level: "info" });
    };

    // ── ANALYSIS ────────────────────────────────────────────────────
    const createIdeaFromAnalysis: ContextValue["createIdeaFromAnalysis"] = (analysisId) => {
      const a = state.analyses.find((x) => x.id === analysisId);
      if (!a) return null;
      const idea = buildIdeaFromAnalysis(a);
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

    // ── IDEAS ───────────────────────────────────────────────────────
    const acceptIdea = (id: string) => {
      dispatch({ type: "PATCH_IDEA", id, patch: { status: "accepted" } });
      log({ stage: "ideas", action: "accept", entity_id: id, message: `Идея ${id} принята`, level: "success" });
    };
    const rejectIdea = (id: string) => {
      dispatch({ type: "PATCH_IDEA", id, patch: { status: "rejected" } });
      log({ stage: "ideas", action: "reject", entity_id: id, message: `Идея ${id} отклонена`, level: "warn" });
    };

    const createContentPackFromIdea: ContextValue["createContentPackFromIdea"] = (ideaId) => {
      const idea = state.ideas.find((i) => i.id === ideaId);
      if (!idea) return null;
      const existing = state.packs.find((p) => p.idea_id === ideaId);
      if (existing) {
        log({ stage: "packs", action: "build_pack", entity_id: existing.id, message: `Пакет для идеи ${ideaId} уже существует (${existing.id})`, level: "info" });
        return existing.id;
      }
      const { pack, assets, checks } = buildPackFromIdea(idea);
      dispatch({ type: "ADD_PACK", payload: pack });
      dispatch({ type: "ADD_ASSETS", payload: assets });
      dispatch({ type: "ADD_CHECKS", payload: checks });
      dispatch({ type: "PATCH_IDEA", id: ideaId, patch: { status: "in_pack" } });
      log({ stage: "packs", action: "build_pack", entity_id: pack.id, message: `Собран контент-пакет ${pack.id} (${assets.length} ассетов)`, level: "success" });
      return pack.id;
    };

    // ── PACKS / ASSETS ──────────────────────────────────────────────
    const requestAssetRewrite = (assetId: string) => {
      const a = state.assets.find((x) => x.id === assetId);
      if (!a) return;
      const patch = bumpAssetVersion(a);
      dispatch({ type: "PATCH_ASSET", id: assetId, patch });
      log({ stage: "packs", action: "rewrite_asset", entity_id: assetId, message: `Ассет ${assetId} → версия v${patch.version}`, level: "info" });
    };

    const sendPackToReview = (packId: string) => {
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "ready_for_review" } });
      state.assets.filter((a) => a.pack_id === packId).forEach((a) =>
        dispatch({ type: "PATCH_ASSET", id: a.id, patch: { status: "ready_for_review" as AssetStatus } }),
      );
      log({ stage: "packs", action: "to_review", entity_id: packId, message: `Пакет ${packId} → на проверку`, level: "info" });
    };

    const requestPackRewrite = (packId: string) => {
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

    // ── REVIEW ──────────────────────────────────────────────────────
    const toggleCheck = (checkId: string) => {
      const c = state.reviewChecks.find((x) => x.id === checkId);
      if (!c) return;
      dispatch({ type: "PATCH_CHECK", id: checkId, patch: { passed: !c.passed } });
      log({ stage: "review", action: "toggle_check", entity_id: checkId, message: `Чек «${c.label}»: ${!c.passed ? "✓" : "✗"}`, level: "info" });
    };
    const canApprove = (packId: string) => canApprovePack(state.reviewChecks, packId);

    // ── PUBLISH ─────────────────────────────────────────────────────
    /**
     * Hard rule (mirrored in transitions.canPublishPack):
     *   pack.status === "approved" && approved_by && approved_at.
     */
    const canPublish = (packId: string) =>
      canPublishPack(state.packs.find((p) => p.id === packId));

    const publishPack = (packId: string) => {
      const pack = state.packs.find((p) => p.id === packId);
      if (!canPublish(packId) || !pack) {
        log({ stage: "publish", action: "publish_blocked", entity_id: packId, message: `Блок: нельзя публиковать пакет ${packId} без approve (status/approved_by/approved_at)`, level: "error" });
        return;
      }
      const assets = state.assets.filter((a) => a.pack_id === packId);
      const jobs = buildPublishJobs(pack, assets);
      dispatch({ type: "ADD_PUBLISH_JOBS", payload: jobs });
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "publishing" as PackStatus } });
      log({ stage: "publish", action: "schedule", entity_id: packId, message: `Запущено ${jobs.length} job через n8n/DOHOO`, level: "info" });

      // simulate publishing (mock — replaced by n8n callback later)
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
        dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "published" as PackStatus } });
        const metrics = buildMetricsForPack(pack, jobs);
        dispatch({ type: "ADD_METRICS", payload: metrics });
        log({ stage: "publish", action: "publish", entity_id: packId, message: `Пакет ${packId} опубликован`, level: "success" });
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

    // ── METRICS ─────────────────────────────────────────────────────
    const createAnalysisSignalFromMetrics = (metricId: string) => {
      const m = state.metrics.find((x) => x.id === metricId);
      if (!m) return;
      const analysis = buildAnalysisFromMetric(m);
      dispatch({ type: "ADD_ANALYSIS", payload: analysis });
      dispatch({ type: "PATCH_METRIC", id: metricId, patch: { signaled: true } });
      log({ stage: "metrics", action: "signal_to_analysis", entity_id: metricId, message: `Сигнал из метрик ${metricId} → анализ ${analysis.id}`, level: "success" });
    };

    return {
      ...state,
      addSource, parseSource, rejectSource, sendSourceToAnalysis,
      createIdeaFromAnalysis, archiveAnalysis, stopAnalysis,
      acceptIdea, rejectIdea,
      createContentPackFromIdea, buildPackFromIdea: createContentPackFromIdea,
      requestAssetRewrite, requestRewriteAsset: requestAssetRewrite,
      sendPackToReview, submitPackForReview: sendPackToReview,
      requestPackRewrite, requestRewrite: requestPackRewrite,
      rejectPack, approvePack, updateAssetText,
      toggleCheck, canApprove,
      publishPack, retryPublishJob, canPublish,
      createAnalysisSignalFromMetrics, signalMetricToAnalysis: createAnalysisSignalFromMetrics,
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

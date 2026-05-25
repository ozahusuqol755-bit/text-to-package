import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
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
import { API_BASE_URL, backendApi } from "@/lib/backendApi";

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
  apiMode: "idle" | "loading" | "ready" | "unavailable";
  apiMessage?: string;
  apiAction?: string;
  apiNotice?: string;
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
  apiMode: "idle",
  apiMessage: "API ещё не проверен. Пока показаны демо-данные.",
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
  | { type: "LOG"; payload: LogEvent }
  | {
      type: "SET_BACKEND_DATA";
      payload: Pick<
        State,
        "sources" | "analyses" | "ideas" | "packs" | "assets" | "reviewChecks" | "logs"
      >;
    }
  | {
      type: "SET_API_STATE";
      patch: Pick<State, "apiMode"> &
        Partial<Pick<State, "apiMessage" | "apiAction" | "apiNotice">>;
    };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_SOURCE":
      return { ...state, sources: [action.payload, ...state.sources] };
    case "PATCH_SOURCE":
      return {
        ...state,
        sources: state.sources.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
      };
    case "ADD_ANALYSIS":
      return { ...state, analyses: [action.payload, ...state.analyses] };
    case "PATCH_ANALYSIS":
      return {
        ...state,
        analyses: state.analyses.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
      };
    case "ADD_IDEA":
      return { ...state, ideas: [action.payload, ...state.ideas] };
    case "PATCH_IDEA":
      return {
        ...state,
        ideas: state.ideas.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
      };
    case "ADD_PACK":
      return { ...state, packs: [action.payload, ...state.packs] };
    case "PATCH_PACK":
      return {
        ...state,
        packs: state.packs.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
      };
    case "ADD_ASSETS":
      return { ...state, assets: [...action.payload, ...state.assets] };
    case "PATCH_ASSET":
      return {
        ...state,
        assets: state.assets.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
      };
    case "ADD_CHECKS":
      return { ...state, reviewChecks: [...state.reviewChecks, ...action.payload] };
    case "PATCH_CHECK":
      return {
        ...state,
        reviewChecks: state.reviewChecks.map((x) =>
          x.id === action.id ? { ...x, ...action.patch } : x,
        ),
      };
    case "ADD_PUBLISH_JOBS":
      return { ...state, publishJobs: [...action.payload, ...state.publishJobs] };
    case "PATCH_PUBLISH_JOB":
      return {
        ...state,
        publishJobs: state.publishJobs.map((x) =>
          x.id === action.id ? { ...x, ...action.patch } : x,
        ),
      };
    case "ADD_METRICS":
      return { ...state, metrics: [...action.payload, ...state.metrics] };
    case "PATCH_METRIC":
      return {
        ...state,
        metrics: state.metrics.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
      };
    case "LOG":
      return { ...state, logs: [action.payload, ...state.logs].slice(0, 300) };
    case "SET_BACKEND_DATA":
      return {
        ...state,
        ...action.payload,
        apiMode: "ready",
        apiMessage: `API подключен: ${API_BASE_URL}`,
      };
    case "SET_API_STATE":
      return { ...state, ...action.patch };
    default:
      return state;
  }
}

interface ContextValue extends State {
  refreshBackendData: () => Promise<void>;
  demoUploadReference: () => Promise<void>;
  demoAnalyzeLatestSource: () => Promise<void>;
  demoCreateIdeaFromLatestAnalysis: () => Promise<void>;
  demoBuildPackFromLatestIdea: () => Promise<void>;
  demoSendLatestPackToReview: () => Promise<void>;
  demoApproveLatestPack: () => Promise<void>;
  demoRejectLatestPack: () => Promise<void>;
  importGoogleSheetRefs: (url: string) => Promise<void>;
  importCsvRefs: (csv: string) => Promise<void>;
  analyzeSourceViaBackend: (sourceId: string) => Promise<void>;
  analyzeSourcesBulkViaBackend: (sourceIds: string[]) => Promise<void>;
  createIdeaViaBackend: (analysisId: string) => Promise<void>;
  createContentPackViaBackend: (ideaId: string) => Promise<void>;
  // sources
  addSource: (input: {
    title: string;
    url?: string;
    source_type: SourceType;
    tags: string[];
  }) => void;
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

function apiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "API недоступен. Оставлены демо-данные.";
}

function latestSourceForAnalysis(sources: Source[]): Source | undefined {
  return (
    sources.find((source) => source.status === "new") ??
    sources.find((source) => source.status === "imported" || source.status === "uploaded") ??
    sources[0]
  );
}

function latestPackForReview(packs: ContentPack[]): ContentPack | undefined {
  return packs.find((pack) => pack.status === "ready_for_review") ?? packs[0];
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshBackendData = useCallback(async () => {
    dispatch({
      type: "SET_API_STATE",
      patch: {
        apiMode: "loading",
        apiMessage: `Подключаем API: ${API_BASE_URL}`,
        apiAction: "refresh",
      },
    });

    try {
      const data = await backendApi.getAll();
      dispatch({ type: "SET_BACKEND_DATA", payload: data });
      dispatch({
        type: "SET_API_STATE",
        patch: {
          apiMode: "ready",
          apiMessage: `API подключен: ${API_BASE_URL}`,
          apiAction: undefined,
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_API_STATE",
        patch: {
          apiMode: "unavailable",
          apiMessage: apiErrorMessage(error),
          apiAction: undefined,
        },
      });
    }
  }, []);

  useEffect(() => {
    void refreshBackendData();
  }, [refreshBackendData]);

  const value = useMemo<ContextValue>(() => {
    const LEVEL_TO_RESULT = {
      success: "success",
      info: "success",
      warn: "warning",
      error: "error",
    } as const;
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

    const runBackendAction = async (action: string, fn: () => Promise<string>) => {
      dispatch({
        type: "SET_API_STATE",
        patch: {
          apiMode: state.apiMode === "ready" ? "ready" : "loading",
          apiAction: action,
          apiNotice: undefined,
        },
      });

      try {
        const message = await fn();
        const data = await backendApi.getAll();
        dispatch({ type: "SET_BACKEND_DATA", payload: data });
        dispatch({
          type: "SET_API_STATE",
          patch: {
            apiMode: "ready",
            apiAction: undefined,
            apiNotice: message,
            apiMessage: message,
          },
        });
      } catch (error) {
        dispatch({
          type: "SET_API_STATE",
          patch: {
            apiMode: "unavailable",
            apiAction: undefined,
            apiNotice: apiErrorMessage(error),
            apiMessage: "API недоступен / демо-данные",
          },
        });
      }
    };

    const demoUploadReference = () =>
      runBackendAction("upload_ref", async () => {
        const stamp = new Date().toLocaleString("ru-RU");
        const source = await backendApi.createSource({
          title: `Demo ref ${stamp}`,
          source_type: "url",
          url: "https://example.com/content-factory-demo",
          raw_text:
            "Демо-реф для закрытого показа: оператор запускает реальный backend flow из Mini App.",
          tags: ["demo", "frontend", "api"],
        });
        return `Источник создан: ${source.title}`;
      });

    const demoAnalyzeLatestSource = () =>
      runBackendAction("analyze_source", async () => {
        const source = latestSourceForAnalysis(state.sources);
        if (!source) throw new Error("Нет источника для анализа.");
        const analysis = await backendApi.sourceToAnalysis(source.id);
        return `Анализ создан: ${analysis.id}`;
      });

    const demoCreateIdeaFromLatestAnalysis = () =>
      runBackendAction("create_idea", async () => {
        const analysis = state.analyses[0];
        if (!analysis) throw new Error("Нет анализа для создания идеи.");
        const idea = await backendApi.createIdea(analysis.id);
        return `Идея создана: ${idea.topic}`;
      });

    const demoBuildPackFromLatestIdea = () =>
      runBackendAction("build_pack", async () => {
        const idea = state.ideas[0];
        if (!idea) throw new Error("Нет идеи для сборки пакета.");
        const result = await backendApi.ideaToContentPack(idea.id);
        return `Контент-пакет собран: ${result.assets.length} ассета`;
      });

    const demoSendLatestPackToReview = () =>
      runBackendAction("send_to_review", async () => {
        const pack = latestPackForReview(state.packs);
        if (!pack) throw new Error("Нет контент-пакета для проверки.");
        await backendApi.sendToReview(pack.id);
        return "Пакет отправлен на проверку";
      });

    const demoApproveLatestPack = () =>
      runBackendAction("approve_pack", async () => {
        const pack = latestPackForReview(state.packs);
        if (!pack) throw new Error("Нет контент-пакета для approve.");
        const result = await backendApi.approvePack(pack.id);
        return `Approved: ${result.pack.approved_by ?? "operator"}`;
      });

    const demoRejectLatestPack = () =>
      runBackendAction("reject_pack", async () => {
        const pack = latestPackForReview(state.packs);
        if (!pack) throw new Error("Нет контент-пакета для reject.");
        await backendApi.rejectPack(pack.id, "Rejected from frontend demo flow");
        return "Пакет отклонён";
      });

    const importGoogleSheetRefs = (url: string) =>
      runBackendAction("import_google_sheet_refs", async () => {
        const result = await backendApi.importGoogleSheetSources(url);
        return `Импортировано refs: ${result.imported_count}`;
      });

    const importCsvRefs = (csv: string) =>
      runBackendAction("import_csv_refs", async () => {
        const result = await backendApi.importCsvSources(csv);
        return `Импортировано refs: ${result.imported_count}`;
      });

    const analyzeSourceViaBackend = (sourceId: string) =>
      runBackendAction("analyze_selected_source", async () => {
        const analysis = await backendApi.sourceToAnalysis(sourceId);
        return `Ref отправлен в Analysis: ${analysis.id}`;
      });

    const analyzeSourcesBulkViaBackend = (sourceIds: string[]) =>
      runBackendAction("analyze_refs_bulk", async () => {
        if (sourceIds.length === 0) throw new Error("Выберите refs для анализа.");
        const result = await backendApi.sourcesToAnalysisBulk(sourceIds);
        if (result.errors.length > 0) {
          return `Analysis: ${result.analysis_count} refs, ошибок: ${result.errors.length}`;
        }
        return `Analysis готов: ${result.analysis_count} refs`;
      });

    const createIdeaViaBackend = (analysisId: string) =>
      runBackendAction("create_idea_from_analysis", async () => {
        const idea = await backendApi.analysisToIdea(analysisId);
        return `Идея создана: ${idea.topic}`;
      });

    const createContentPackViaBackend = (ideaId: string) =>
      runBackendAction("create_content_pack_from_idea", async () => {
        const result = await backendApi.ideaToContentPack(ideaId);
        return `Контент-пакет создан: ${result.pack.title}`;
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
      log({
        stage: "sources",
        action: "add_source",
        entity_type: "source",
        entity_id: src.id,
        status_after: "new",
        message: `Добавлен источник: ${src.title}`,
        level: "info",
      });
    };

    const parseSource = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      if (!src) return;
      const patch = parseSourcePure(src);
      dispatch({ type: "PATCH_SOURCE", id, patch });
      log({
        stage: "sources",
        action: "parse",
        entity_type: "source",
        entity_id: id,
        status_before: src.status,
        status_after: patch.status ?? "parsed",
        message: `Источник ${id} распарсен`,
        level: "success",
      });
    };

    const rejectSource = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      dispatch({ type: "PATCH_SOURCE", id, patch: { status: "rejected" } });
      log({
        stage: "sources",
        action: "reject",
        entity_type: "source",
        entity_id: id,
        status_before: src?.status,
        status_after: "rejected",
        message: `Источник ${id} отклонён`,
        level: "warn",
      });
    };

    const sendSourceToAnalysis = (id: string) => {
      const src = state.sources.find((x) => x.id === id);
      if (!src) return;
      dispatch({ type: "PATCH_SOURCE", id, patch: { status: "ready_for_analysis" } });
      const analysis = buildAnalysisFromSource(src);
      dispatch({ type: "ADD_ANALYSIS", payload: analysis });
      log({
        stage: "sources",
        action: "to_analysis",
        entity_type: "source",
        entity_id: id,
        status_before: src.status,
        status_after: "ready_for_analysis",
        message: `Источник ${id} → анализ ${analysis.id}`,
        level: "info",
      });
    };

    // ── ANALYSIS ────────────────────────────────────────────────────
    const createIdeaFromAnalysis: ContextValue["createIdeaFromAnalysis"] = (analysisId) => {
      const a = state.analyses.find((x) => x.id === analysisId);
      if (!a) return null;
      const idea = buildIdeaFromAnalysis(a);
      dispatch({ type: "ADD_IDEA", payload: idea });
      dispatch({ type: "PATCH_ANALYSIS", id: analysisId, patch: { decision: "to_idea" } });
      log({
        stage: "analysis",
        action: "create_idea",
        entity_type: "analysis",
        entity_id: analysisId,
        status_before: a.decision,
        status_after: "to_idea",
        message: `Из анализа ${analysisId} создана идея ${idea.id}`,
        level: "success",
      });
      return idea.id;
    };

    const archiveAnalysis = (analysisId: string) => {
      const a = state.analyses.find((x) => x.id === analysisId);
      dispatch({
        type: "PATCH_ANALYSIS",
        id: analysisId,
        patch: { decision: "archive", risk_status: "archived" },
      });
      log({
        stage: "analysis",
        action: "archive",
        entity_type: "analysis",
        entity_id: analysisId,
        status_before: a?.risk_status,
        status_after: "archived",
        message: `Анализ ${analysisId} в архив`,
        level: "info",
      });
    };

    const stopAnalysis = (analysisId: string) => {
      const a = state.analyses.find((x) => x.id === analysisId);
      dispatch({
        type: "PATCH_ANALYSIS",
        id: analysisId,
        patch: { decision: "stop", risk_status: "stopped" },
      });
      log({
        stage: "analysis",
        action: "stop",
        entity_type: "analysis",
        entity_id: analysisId,
        status_before: a?.risk_status,
        status_after: "stopped",
        message: `Анализ ${analysisId} остановлен (risk_status=stopped)`,
        level: "warn",
      });
    };

    // ── IDEAS ───────────────────────────────────────────────────────
    const acceptIdea = (id: string) => {
      const i = state.ideas.find((x) => x.id === id);
      dispatch({ type: "PATCH_IDEA", id, patch: { status: "accepted" } });
      log({
        stage: "ideas",
        action: "accept",
        entity_type: "idea",
        entity_id: id,
        status_before: i?.status,
        status_after: "accepted",
        message: `Идея ${id} принята`,
        level: "success",
      });
    };
    const rejectIdea = (id: string) => {
      const i = state.ideas.find((x) => x.id === id);
      dispatch({ type: "PATCH_IDEA", id, patch: { status: "rejected" } });
      log({
        stage: "ideas",
        action: "reject",
        entity_type: "idea",
        entity_id: id,
        status_before: i?.status,
        status_after: "rejected",
        message: `Идея ${id} отклонена`,
        level: "warn",
      });
    };

    const createContentPackFromIdea: ContextValue["createContentPackFromIdea"] = (ideaId) => {
      const idea = state.ideas.find((i) => i.id === ideaId);
      if (!idea) return null;
      const existing = state.packs.find((p) => p.idea_id === ideaId);
      if (existing) {
        log({
          stage: "packs",
          action: "build_pack",
          entity_type: "pack",
          entity_id: existing.id,
          status_after: existing.status,
          message: `Пакет для идеи ${ideaId} уже существует (${existing.id})`,
          level: "info",
        });
        return existing.id;
      }
      const { pack, assets, checks } = buildPackFromIdea(idea);
      dispatch({ type: "ADD_PACK", payload: pack });
      dispatch({ type: "ADD_ASSETS", payload: assets });
      dispatch({ type: "ADD_CHECKS", payload: checks });
      dispatch({ type: "PATCH_IDEA", id: ideaId, patch: { status: "in_pack" } });
      log({
        stage: "packs",
        action: "build_pack",
        entity_type: "pack",
        entity_id: pack.id,
        status_after: pack.status,
        message: `Собран контент-пакет ${pack.id} (${assets.length} ассетов)`,
        level: "success",
      });
      return pack.id;
    };

    // ── PACKS / ASSETS ──────────────────────────────────────────────
    const requestAssetRewrite = (assetId: string) => {
      const a = state.assets.find((x) => x.id === assetId);
      if (!a) return;
      const patch = bumpAssetVersion(a);
      dispatch({ type: "PATCH_ASSET", id: assetId, patch });
      log({
        stage: "packs",
        action: "rewrite_asset",
        entity_type: "asset",
        entity_id: assetId,
        status_before: a.status,
        status_after: patch.status,
        message: `Ассет ${assetId} → версия v${patch.version}`,
        level: "info",
      });
    };

    const sendPackToReview = (packId: string) => {
      const pack = state.packs.find((p) => p.id === packId);
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "ready_for_review" } });
      state.assets
        .filter((a) => a.pack_id === packId)
        .forEach((a) =>
          dispatch({
            type: "PATCH_ASSET",
            id: a.id,
            patch: { status: "ready_for_review" as AssetStatus },
          }),
        );
      log({
        stage: "packs",
        action: "to_review",
        entity_type: "pack",
        entity_id: packId,
        status_before: pack?.status,
        status_after: "ready_for_review",
        message: `Пакет ${packId} → на проверку`,
        level: "info",
      });
    };

    const requestPackRewrite = (packId: string) => {
      const pack = state.packs.find((p) => p.id === packId);
      dispatch({
        type: "PATCH_PACK",
        id: packId,
        patch: { status: "rewrite_requested" as PackStatus },
      });
      log({
        stage: "review",
        action: "rewrite",
        entity_type: "pack",
        entity_id: packId,
        status_before: pack?.status,
        status_after: "rewrite_requested",
        message: `Запрошен rewrite пакета ${packId}`,
        level: "warn",
      });
    };
    const rejectPack = (packId: string) => {
      const pack = state.packs.find((p) => p.id === packId);
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "rejected" as PackStatus } });
      log({
        stage: "review",
        action: "reject",
        entity_type: "pack",
        entity_id: packId,
        status_before: pack?.status,
        status_after: "rejected",
        message: `Пакет ${packId} отклонён`,
        level: "error",
      });
    };
    const approvePack = (packId: string, approver = EDITOR) => {
      const pack = state.packs.find((p) => p.id === packId);
      if (!canApprove(packId)) {
        log({
          stage: "review",
          action: "approve_blocked",
          entity_type: "pack",
          entity_id: packId,
          status_before: pack?.status,
          result: "error",
          message: `Approve заблокирован: не все обязательные пункты checklist отмечены`,
          level: "error",
        });
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
      state.assets
        .filter((a) => a.pack_id === packId)
        .forEach((a) =>
          dispatch({ type: "PATCH_ASSET", id: a.id, patch: { status: "approved" as AssetStatus } }),
        );
      log({
        stage: "review",
        action: "approve",
        entity_type: "pack",
        entity_id: packId,
        status_before: pack?.status,
        status_after: "approved",
        actor: approver,
        message: `Пакет ${packId} одобрен (${approver})`,
        level: "success",
      });
    };
    const updateAssetText: ContextValue["updateAssetText"] = (assetId, text) => {
      const a = state.assets.find((x) => x.id === assetId);
      if (!a) return;
      const patch: Partial<ContentAsset> =
        a.image_prompt !== undefined
          ? { image_prompt: text }
          : a.video_prompt !== undefined
            ? { video_prompt: text }
            : { text };
      dispatch({ type: "PATCH_ASSET", id: assetId, patch });
      log({
        stage: "packs",
        action: "edit_asset",
        entity_type: "asset",
        entity_id: assetId,
        status_before: a.status,
        status_after: a.status,
        message: `Ассет ${assetId} отредактирован`,
        level: "info",
      });
    };

    // ── REVIEW ──────────────────────────────────────────────────────
    const toggleCheck = (checkId: string) => {
      const c = state.reviewChecks.find((x) => x.id === checkId);
      if (!c) return;
      dispatch({ type: "PATCH_CHECK", id: checkId, patch: { passed: !c.passed } });
      log({
        stage: "review",
        action: "toggle_check",
        entity_type: "check",
        entity_id: checkId,
        status_before: c.passed ? "passed" : "pending",
        status_after: !c.passed ? "passed" : "pending",
        message: `Чек «${c.label}»: ${!c.passed ? "✓" : "✗"}`,
        level: "info",
      });
    };
    const canApprove = (packId: string) => canApprovePack(state.reviewChecks, packId);

    // ── PUBLISH ─────────────────────────────────────────────────────
    /**
     * Hard rule (mirrored in transitions.canPublishPack):
     *   pack.status === "approved" && approved_by && approved_at.
     */
    const canPublish = (packId: string) => canPublishPack(state.packs.find((p) => p.id === packId));

    const publishPack = (packId: string) => {
      const pack = state.packs.find((p) => p.id === packId);
      if (!canPublish(packId) || !pack) {
        log({
          stage: "publish",
          action: "publish_blocked",
          entity_type: "pack",
          entity_id: packId,
          status_before: pack?.status,
          result: "error",
          message: `Блок: нельзя публиковать пакет ${packId} без approve (status/approved_by/approved_at)`,
          level: "error",
        });
        return;
      }
      const assets = state.assets.filter((a) => a.pack_id === packId);
      const jobs = buildPublishJobs(pack, assets);
      dispatch({ type: "ADD_PUBLISH_JOBS", payload: jobs });
      dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "publishing" as PackStatus } });
      log({
        stage: "publish",
        action: "schedule",
        entity_type: "pack",
        entity_id: packId,
        status_before: "approved",
        status_after: "publishing",
        message: `Запущено ${jobs.length} job через n8n/DOHOO`,
        level: "info",
      });

      // simulate publishing (mock — replaced by n8n callback later)
      window.setTimeout(() => {
        const failIdx = Math.floor(Math.random() * jobs.length);
        jobs.forEach((j, idx) => {
          if (idx === failIdx && jobs.length > 1) {
            dispatch({
              type: "PATCH_PUBLISH_JOB",
              id: j.id,
              patch: { status: "failed" as PublishStatus, error: "API timeout" },
            });
            log({
              stage: "publish",
              action: "fail",
              entity_type: "publish_job",
              entity_id: j.id,
              job_id: j.id,
              status_before: "publishing",
              status_after: "failed",
              result: "error",
              message: `Job ${j.id} (${j.platform}) failed: API timeout`,
              level: "error",
            });
          } else {
            dispatch({
              type: "PATCH_PUBLISH_JOB",
              id: j.id,
              patch: {
                status: "published" as PublishStatus,
                published_at: new Date().toISOString(),
              },
            });
            log({
              stage: "publish",
              action: "publish",
              entity_type: "publish_job",
              entity_id: j.id,
              job_id: j.id,
              status_before: "publishing",
              status_after: "published",
              message: `Job ${j.id} (${j.platform}) опубликован`,
              level: "success",
            });
          }
        });
        dispatch({ type: "PATCH_PACK", id: packId, patch: { status: "published" as PackStatus } });
        const metrics = buildMetricsForPack(pack, jobs);
        dispatch({ type: "ADD_METRICS", payload: metrics });
        log({
          stage: "publish",
          action: "publish",
          entity_type: "pack",
          entity_id: packId,
          status_before: "publishing",
          status_after: "published",
          message: `Пакет ${packId} опубликован`,
          level: "success",
        });
      }, 1400);
    };

    const retryPublishJob = (jobId: string) => {
      const j = state.publishJobs.find((x) => x.id === jobId);
      if (!j) return;
      dispatch({
        type: "PATCH_PUBLISH_JOB",
        id: jobId,
        patch: {
          status: "publishing" as PublishStatus,
          error: undefined,
          attempts: j.attempts + 1,
        },
      });
      log({
        stage: "publish",
        action: "retry",
        entity_type: "publish_job",
        entity_id: jobId,
        job_id: jobId,
        status_before: j.status,
        status_after: "publishing",
        result: "warning",
        message: `Retry job ${jobId} (попытка ${j.attempts + 1})`,
        level: "warn",
      });
      window.setTimeout(() => {
        dispatch({
          type: "PATCH_PUBLISH_JOB",
          id: jobId,
          patch: { status: "published" as PublishStatus, published_at: new Date().toISOString() },
        });
        log({
          stage: "publish",
          action: "publish",
          entity_type: "publish_job",
          entity_id: jobId,
          job_id: jobId,
          status_before: "publishing",
          status_after: "published",
          message: `Job ${jobId} опубликован после retry`,
          level: "success",
        });
      }, 1000);
    };

    // ── METRICS ─────────────────────────────────────────────────────
    const createAnalysisSignalFromMetrics = (metricId: string) => {
      const m = state.metrics.find((x) => x.id === metricId);
      if (!m) return;
      const analysis = buildAnalysisFromMetric(m);
      dispatch({ type: "ADD_ANALYSIS", payload: analysis });
      dispatch({ type: "PATCH_METRIC", id: metricId, patch: { signaled: true } });
      log({
        stage: "metrics",
        action: "signal_to_analysis",
        entity_type: "metric",
        entity_id: metricId,
        status_after: "signaled",
        message: `Сигнал из метрик ${metricId} → анализ ${analysis.id}`,
        level: "success",
      });
    };

    return {
      ...state,
      refreshBackendData,
      demoUploadReference,
      demoAnalyzeLatestSource,
      demoCreateIdeaFromLatestAnalysis,
      demoBuildPackFromLatestIdea,
      demoSendLatestPackToReview,
      demoApproveLatestPack,
      demoRejectLatestPack,
      importGoogleSheetRefs,
      importCsvRefs,
      analyzeSourceViaBackend,
      analyzeSourcesBulkViaBackend,
      createIdeaViaBackend,
      createContentPackViaBackend,
      addSource,
      parseSource,
      rejectSource,
      sendSourceToAnalysis,
      createIdeaFromAnalysis,
      archiveAnalysis,
      stopAnalysis,
      acceptIdea,
      rejectIdea,
      createContentPackFromIdea,
      buildPackFromIdea: createContentPackFromIdea,
      requestAssetRewrite,
      requestRewriteAsset: requestAssetRewrite,
      sendPackToReview,
      submitPackForReview: sendPackToReview,
      requestPackRewrite,
      requestRewrite: requestPackRewrite,
      rejectPack,
      approvePack,
      updateAssetText,
      toggleCheck,
      canApprove,
      publishPack,
      retryPublishJob,
      canPublish,
      createAnalysisSignalFromMetrics,
      signalMetricToAnalysis: createAnalysisSignalFromMetrics,
      log,
    };
  }, [refreshBackendData, state]);

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}

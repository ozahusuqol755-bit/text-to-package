import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  Analysis,
  ContentAsset,
  ContentPack,
  Idea,
  LogEvent,
  Metric,
  PublishJob,
  ReviewCheck,
  Source,
  SourceStatus,
  PackStatus,
  Tool,
  IdeaStatus,
  AssetStatus,
  PublishStatus,
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
  | { type: "UPDATE_SOURCE_STATUS"; id: string; status: SourceStatus }
  | { type: "UPDATE_IDEA_STATUS"; id: string; status: IdeaStatus }
  | { type: "UPDATE_PACK_STATUS"; id: string; status: PackStatus; approved_by?: string }
  | { type: "UPDATE_ASSET_STATUS"; id: string; status: AssetStatus }
  | { type: "UPDATE_ASSET_TEXT"; id: string; text: string }
  | { type: "ADD_PUBLISH_JOBS"; payload: PublishJob[] }
  | { type: "UPDATE_PUBLISH_JOB"; id: string; status: PublishStatus }
  | { type: "LOG"; payload: LogEvent };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_SOURCE":
      return { ...state, sources: [action.payload, ...state.sources] };
    case "UPDATE_SOURCE_STATUS":
      return {
        ...state,
        sources: state.sources.map((s) =>
          s.id === action.id ? { ...s, status: action.status } : s,
        ),
      };
    case "UPDATE_IDEA_STATUS":
      return {
        ...state,
        ideas: state.ideas.map((i) =>
          i.id === action.id ? { ...i, status: action.status } : i,
        ),
      };
    case "UPDATE_PACK_STATUS":
      return {
        ...state,
        packs: state.packs.map((p) =>
          p.id === action.id
            ? {
                ...p,
                status: action.status,
                approved_by: action.approved_by ?? p.approved_by,
                approved_at:
                  action.status === "approved" ? new Date().toISOString() : p.approved_at,
              }
            : p,
        ),
      };
    case "UPDATE_ASSET_STATUS":
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === action.id ? { ...a, status: action.status } : a,
        ),
      };
    case "UPDATE_ASSET_TEXT":
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === action.id ? { ...a, text: action.text } : a,
        ),
      };
    case "ADD_PUBLISH_JOBS":
      return { ...state, publishJobs: [...action.payload, ...state.publishJobs] };
    case "UPDATE_PUBLISH_JOB":
      return {
        ...state,
        publishJobs: state.publishJobs.map((j) =>
          j.id === action.id
            ? {
                ...j,
                status: action.status,
                published_at:
                  action.status === "published" ? new Date().toISOString() : j.published_at,
              }
            : j,
        ),
      };
    case "LOG":
      return { ...state, logs: [action.payload, ...state.logs].slice(0, 200) };
    default:
      return state;
  }
}

interface ContextValue extends State {
  // sources
  addSource: (input: Omit<Source, "id" | "created_at" | "status">) => void;
  parseSource: (id: string) => void;
  rejectSource: (id: string) => void;
  sendSourceToAnalysis: (id: string) => void;
  // ideas
  acceptIdea: (id: string) => void;
  rejectIdea: (id: string) => void;
  // packs
  requestRewrite: (packId: string) => void;
  rejectPack: (packId: string) => void;
  approvePack: (packId: string, approver: string) => void;
  updateAssetText: (assetId: string, text: string) => void;
  // publish
  publishPack: (packId: string) => void;
  // helpers
  canPublish: (packId: string) => boolean;
  log: (e: Omit<LogEvent, "id" | "ts">) => void;
}

const PipelineContext = createContext<ContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<ContextValue>(() => {
    const log = (e: Omit<LogEvent, "id" | "ts">) =>
      dispatch({
        type: "LOG",
        payload: { id: uid("log"), ts: new Date().toISOString(), ...e },
      });

    const addSource: ContextValue["addSource"] = (input) => {
      const src: Source = {
        ...input,
        id: uid("src"),
        status: "new",
        created_at: new Date().toISOString(),
      };
      dispatch({ type: "ADD_SOURCE", payload: src });
      log({ stage: "sources", message: `Добавлен источник: ${src.title}`, level: "info", entity_id: src.id });
    };

    const parseSource = (id: string) => {
      dispatch({ type: "UPDATE_SOURCE_STATUS", id, status: "parsed" });
      log({ stage: "sources", message: `Парсинг источника ${id}: raw_text → summary → hooks`, level: "success", entity_id: id });
    };

    const rejectSource = (id: string) => {
      dispatch({ type: "UPDATE_SOURCE_STATUS", id, status: "rejected" });
      log({ stage: "sources", message: `Источник ${id} отклонён`, level: "warn", entity_id: id });
    };

    const sendSourceToAnalysis = (id: string) => {
      dispatch({ type: "UPDATE_SOURCE_STATUS", id, status: "ready_for_analysis" });
      log({ stage: "sources", message: `Источник ${id} передан в анализ`, level: "info", entity_id: id });
    };

    const acceptIdea = (id: string) => {
      dispatch({ type: "UPDATE_IDEA_STATUS", id, status: "accepted" });
      log({ stage: "ideas", message: `Идея ${id} принята`, level: "success", entity_id: id });
    };
    const rejectIdea = (id: string) => {
      dispatch({ type: "UPDATE_IDEA_STATUS", id, status: "rejected" });
      log({ stage: "ideas", message: `Идея ${id} отклонена`, level: "warn", entity_id: id });
    };

    const requestRewrite = (packId: string) => {
      dispatch({ type: "UPDATE_PACK_STATUS", id: packId, status: "rewrite_requested" });
      log({ stage: "review", message: `Запрошен rewrite пакета ${packId}`, level: "warn", entity_id: packId });
    };
    const rejectPack = (packId: string) => {
      dispatch({ type: "UPDATE_PACK_STATUS", id: packId, status: "rejected" });
      log({ stage: "review", message: `Пакет ${packId} отклонён`, level: "error", entity_id: packId });
    };
    const approvePack = (packId: string, approver: string) => {
      dispatch({ type: "UPDATE_PACK_STATUS", id: packId, status: "approved", approved_by: approver });
      // approve all assets in pack
      state.assets
        .filter((a) => a.pack_id === packId)
        .forEach((a) => dispatch({ type: "UPDATE_ASSET_STATUS", id: a.id, status: "approved" }));
      log({ stage: "review", message: `Пакет ${packId} одобрен (${approver})`, level: "success", entity_id: packId });
    };
    const updateAssetText: ContextValue["updateAssetText"] = (assetId, text) => {
      dispatch({ type: "UPDATE_ASSET_TEXT", id: assetId, text });
    };

    const canPublish = (packId: string) => {
      const pack = state.packs.find((p) => p.id === packId);
      return Boolean(pack && pack.status === "approved" && pack.approved_by);
    };

    const publishPack = (packId: string) => {
      if (!canPublish(packId)) {
        log({ stage: "publish", message: `Блок: нельзя публиковать пакет ${packId} без approve`, level: "error", entity_id: packId });
        return;
      }
      const assets = state.assets.filter((a) => a.pack_id === packId);
      const jobs: PublishJob[] = assets.map((a) => ({
        id: uid("job"),
        pack_id: packId,
        asset_id: a.id,
        platform: a.platform,
        tool: a.platform === "telegram" ? "Telegram Bot" : "DOHOO",
        status: "scheduled",
      }));
      dispatch({ type: "ADD_PUBLISH_JOBS", payload: jobs });
      dispatch({ type: "UPDATE_PACK_STATUS", id: packId, status: "scheduled" });
      log({ stage: "publish", message: `Запланировано ${jobs.length} job через n8n/DOHOO`, level: "info", entity_id: packId });
      // simulate publishing
      window.setTimeout(() => {
        jobs.forEach((j) =>
          dispatch({ type: "UPDATE_PUBLISH_JOB", id: j.id, status: "published" }),
        );
        dispatch({ type: "UPDATE_PACK_STATUS", id: packId, status: "published" });
        log({ stage: "publish", message: `Пакет ${packId} опубликован на ${jobs.length} площадках`, level: "success", entity_id: packId });
      }, 1200);
    };

    return {
      ...state,
      addSource,
      parseSource,
      rejectSource,
      sendSourceToAnalysis,
      acceptIdea,
      rejectIdea,
      requestRewrite,
      rejectPack,
      approvePack,
      updateAssetText,
      publishPack,
      canPublish,
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

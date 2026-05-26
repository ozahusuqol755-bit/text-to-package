import type {
  Analysis,
  ContentAsset,
  ContentPack,
  Idea,
  LogEvent,
  ReviewCheck,
  Source,
} from "@/types/pipeline";

const DEFAULT_API_URL = "http://localhost:3001";

export const API_BASE_URL = (import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL).replace(
  /\/$/,
  "",
);

interface ApiEnvelope<T> {
  data: T;
}

interface CreateSourcePayload {
  title: string;
  url?: string;
  source_type: "url" | "text" | "manual" | "viralmaxing";
  raw_text?: string;
  tags?: string[];
}

interface ImportSourcesResponse {
  imported_count: number;
  sources: Source[];
}

interface BulkAnalysisResponse {
  analysis_count: number;
  analyses: Analysis[];
  errors: Array<{ source_id: string; error: string }>;
}

export interface AiRoleStatus {
  configured: boolean;
  model: string | null;
}

export interface AiStatus {
  provider: string;
  mode: "configured" | "fallback";
  baseUrlConfigured: boolean;
  roles: Record<"default" | "fast" | "smart" | "write" | "image" | "video", AiRoleStatus>;
}

export interface AiUsageRecord {
  id: string;
  task_type: string;
  provider: string;
  model_used: string | null;
  key_alias: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: string | number | null;
  status: "success" | "error" | "fallback";
  error_message: string | null;
  created_at: string;
}

export interface AiUsageSummaryBucket {
  count: number;
  total_tokens: number | null;
  estimated_cost: number | null;
}

export interface AiUsageResponse {
  records: AiUsageRecord[];
  summary: {
    by_task_type: Record<string, AiUsageSummaryBucket>;
    by_key_alias: Record<string, AiUsageSummaryBucket>;
    total_tokens: number | null;
    estimated_cost: number | null;
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-telegram-init-data": "dev-frontend-demo",
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function getData<T>(path: string): Promise<T> {
  const envelope = await apiRequest<ApiEnvelope<T>>(path);
  return envelope.data;
}

async function postData<T>(path: string, body?: unknown): Promise<T> {
  const envelope = await apiRequest<ApiEnvelope<T>>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return envelope.data;
}

async function getText(path: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "x-telegram-init-data": "dev-frontend-demo",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.text();
}

export const backendApi = {
  getAiStatus: () => getData<AiStatus>("/api/ai/status"),
  getAiUsage: () => getData<AiUsageResponse>("/api/ai/usage"),

  getSources: () => getData<Source[]>("/api/sources"),
  createSource: (payload: CreateSourcePayload) => postData<Source>("/api/sources", payload),
  importGoogleSheetSources: (url: string) =>
    postData<ImportSourcesResponse>("/api/sources/import/google-sheet", { url }),
  importCsvSources: (csv: string) =>
    postData<ImportSourcesResponse>("/api/sources/import/csv", { csv }),
  sourceToAnalysis: (sourceId: string) =>
    postData<Analysis>(`/api/sources/${sourceId}/to-analysis`),
  sourcesToAnalysisBulk: (sourceIds: string[]) =>
    postData<BulkAnalysisResponse>("/api/sources/to-analysis-bulk", { source_ids: sourceIds }),

  getAnalyses: () => getData<Analysis[]>("/api/analyses"),
  createIdea: (analysisId: string) => postData<Idea>(`/api/analyses/${analysisId}/create-idea`),
  analysisToIdea: (analysisId: string) => postData<Idea>(`/api/analysis/${analysisId}/to-idea`),

  getIdeas: () => getData<Idea[]>("/api/ideas"),
  buildPack: (ideaId: string) =>
    postData<{
      pack: ContentPack;
      assets: ContentAsset[];
      review_checks: ReviewCheck[];
    }>(`/api/ideas/${ideaId}/build-pack`),
  ideaToContentPack: (ideaId: string) =>
    postData<{
      pack: ContentPack;
      assets: ContentAsset[];
      review_checks: ReviewCheck[];
    }>(`/api/ideas/${ideaId}/to-content-pack`),

  getContentPacks: () => getData<ContentPack[]>("/api/content-packs"),
  getPackMarkdownUrl: (packId: string) =>
    `${API_BASE_URL}/api/packs/${encodeURIComponent(packId)}/export/markdown`,
  getPackMarkdown: (packId: string) =>
    getText(`/api/packs/${encodeURIComponent(packId)}/export/markdown`),
  getContentAssets: () => getData<ContentAsset[]>("/api/content-assets"),
  sendToReview: (packId: string) =>
    postData<{ pack: ContentPack; review_checks: ReviewCheck[] }>(
      `/api/content-packs/${packId}/send-to-review`,
    ),
  getReviewChecks: () => getData<ReviewCheck[]>("/api/review-checks"),
  approvePack: (packId: string) =>
    postData<{ pack: ContentPack; review_checks: ReviewCheck[] }>(
      `/api/content-packs/${packId}/approve`,
    ),
  rejectPack: (packId: string, reason: string) =>
    postData<ContentPack>(`/api/content-packs/${packId}/reject`, { reason }),

  getLogs: () => getData<LogEvent[]>("/api/logs"),

  async getAll() {
    const [sources, analyses, ideas, packs, assets, reviewChecks, logs] = await Promise.all([
      this.getSources(),
      this.getAnalyses(),
      this.getIdeas(),
      this.getContentPacks(),
      this.getContentAssets(),
      this.getReviewChecks(),
      this.getLogs(),
    ]);

    return { sources, analyses, ideas, packs, assets, reviewChecks, logs };
  },
};

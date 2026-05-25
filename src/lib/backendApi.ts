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

export const backendApi = {
  getSources: () => getData<Source[]>("/api/sources"),
  createSource: (payload: CreateSourcePayload) => postData<Source>("/api/sources", payload),
  importGoogleSheetSources: (url: string) =>
    postData<ImportSourcesResponse>("/api/sources/import/google-sheet", { url }),
  importCsvSources: (csv: string) =>
    postData<ImportSourcesResponse>("/api/sources/import/csv", { csv }),
  sourceToAnalysis: (sourceId: string) =>
    postData<Analysis>(`/api/sources/${sourceId}/to-analysis`),

  getAnalyses: () => getData<Analysis[]>("/api/analyses"),
  createIdea: (analysisId: string) => postData<Idea>(`/api/analyses/${analysisId}/create-idea`),

  getIdeas: () => getData<Idea[]>("/api/ideas"),
  buildPack: (ideaId: string) =>
    postData<{
      pack: ContentPack;
      assets: ContentAsset[];
      review_checks: ReviewCheck[];
    }>(`/api/ideas/${ideaId}/build-pack`),

  getContentPacks: () => getData<ContentPack[]>("/api/content-packs"),
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

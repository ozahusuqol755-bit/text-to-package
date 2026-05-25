import { config } from "../config.js";

const DEFAULT_AI_TIMEOUT_MS = 20_000;

interface ChatCompletionResponse {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export type AiKeyAlias = "default" | "fast" | "smart" | "write" | "image" | "video";

export type AiTaskType =
  | "bulk_analysis"
  | "analysis"
  | "idea"
  | "content_pack"
  | "image_prompt"
  | "image_generation"
  | "video_prompt"
  | "video_generation";

type AiEnv = Partial<Record<keyof typeof config, string | number>>;

export interface StructuredJsonRequestOptions {
  taskType?: AiTaskType;
  timeoutMs?: number;
}

export interface ResolvedAiTaskConfig {
  provider: string;
  baseUrl: string | null;
  baseUrlConfigured: boolean;
  configured: boolean;
  keyAlias: AiKeyAlias;
  model: string | null;
  apiKey: string | null;
}

export interface AiRoleStatus {
  configured: boolean;
  model: string | null;
}

export interface AiStatus {
  provider: string;
  mode: "configured" | "fallback";
  baseUrlConfigured: boolean;
  roles: Record<AiKeyAlias, AiRoleStatus>;
}

export interface StructuredJsonResult {
  data: unknown;
  provider: string;
  keyAlias: AiKeyAlias;
  modelUsed: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

const ROLE_ENV: Record<AiKeyAlias, { key: keyof typeof config; model: keyof typeof config }> = {
  default: { key: "AI_API_KEY", model: "AI_MODEL" },
  fast: { key: "AI_FAST_API_KEY", model: "AI_FAST_MODEL" },
  smart: { key: "AI_SMART_API_KEY", model: "AI_SMART_MODEL" },
  write: { key: "AI_WRITE_API_KEY", model: "AI_WRITE_MODEL" },
  image: { key: "AI_IMAGE_API_KEY", model: "AI_IMAGE_MODEL" },
  video: { key: "AI_VIDEO_API_KEY", model: "AI_VIDEO_MODEL" },
};

const TASK_ROLE_CANDIDATES: Record<AiTaskType, AiKeyAlias[]> = {
  bulk_analysis: ["fast", "default"],
  analysis: ["smart", "default"],
  idea: ["smart", "write", "default"],
  content_pack: ["write", "default"],
  image_prompt: ["write", "default"],
  image_generation: ["image"],
  video_prompt: ["write", "default"],
  video_generation: ["video"],
};

function readEnv(env: AiEnv, key: keyof typeof config): string {
  return String(env[key] ?? "").trim();
}

function readRoleCredential(env: AiEnv, alias: AiKeyAlias): { apiKey: string; model: string } {
  const role = ROLE_ENV[alias];
  return {
    apiKey: readEnv(env, role.key),
    model: readEnv(env, role.model),
  };
}

function providerFromEnv(env: AiEnv): string {
  return readEnv(env, "AI_PROVIDER") || "openai-compatible";
}

export function resolveAiTaskConfigFromEnv(taskType: AiTaskType, env: AiEnv): ResolvedAiTaskConfig {
  const provider = providerFromEnv(env);
  const baseUrl = readEnv(env, "AI_BASE_URL");
  const baseUrlConfigured = Boolean(baseUrl);
  const candidates = TASK_ROLE_CANDIDATES[taskType];
  const preferredAlias = candidates[0] ?? "default";

  for (const alias of candidates) {
    if (alias === "default") continue;

    const roleCredential = readRoleCredential(env, alias);

    if (roleCredential.apiKey && roleCredential.model && baseUrlConfigured) {
      return {
        provider,
        baseUrl,
        baseUrlConfigured,
        configured: true,
        keyAlias: alias,
        model: roleCredential.model,
        apiKey: roleCredential.apiKey,
      };
    }
  }

  const defaultCredential = readRoleCredential(env, "default");
  if (
    candidates.includes("default") &&
    defaultCredential.apiKey &&
    defaultCredential.model &&
    baseUrlConfigured
  ) {
    return {
      provider,
      baseUrl,
      baseUrlConfigured,
      configured: true,
      keyAlias: "default",
      model: defaultCredential.model,
      apiKey: defaultCredential.apiKey,
    };
  }

  const preferredCredential = readRoleCredential(env, preferredAlias);
  return {
    provider,
    baseUrl: baseUrl || null,
    baseUrlConfigured,
    configured: false,
    keyAlias: preferredAlias,
    model: preferredCredential.model || defaultCredential.model || null,
    apiKey: null,
  };
}

export function resolveAiTaskConfig(taskType: AiTaskType): ResolvedAiTaskConfig {
  return resolveAiTaskConfigFromEnv(taskType, config);
}

export function buildAiStatusFromEnv(env: AiEnv): AiStatus {
  const provider = providerFromEnv(env);
  const baseUrlConfigured = Boolean(readEnv(env, "AI_BASE_URL"));
  const roles = Object.fromEntries(
    (Object.keys(ROLE_ENV) as AiKeyAlias[]).map((alias) => {
      const roleCredential = readRoleCredential(env, alias);
      const defaultCredential = readRoleCredential(env, "default");
      const apiKey = roleCredential.apiKey || (alias === "default" ? "" : defaultCredential.apiKey);
      const model = roleCredential.model || (alias === "default" ? "" : defaultCredential.model);

      return [
        alias,
        {
          configured: baseUrlConfigured && Boolean(apiKey && model),
          model: model || null,
        },
      ];
    }),
  ) as Record<AiKeyAlias, AiRoleStatus>;

  return {
    provider,
    mode:
      baseUrlConfigured && Object.values(roles).some((role) => role.configured)
        ? "configured"
        : "fallback",
    baseUrlConfigured,
    roles,
  };
}

export function getAiStatus(): AiStatus {
  return buildAiStatusFromEnv(config);
}

export function isAiConfigured(taskType: AiTaskType = "analysis"): boolean {
  return resolveAiTaskConfig(taskType).configured;
}

function stripMarkdownFence(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function repairCommonJsonIssues(content: string): string {
  return content.replace(/,\s*([}\]])/g, "$1");
}

export function parseStructuredJson(content: string): unknown {
  const stripped = stripMarkdownFence(content);
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain JSON.");

  const json = repairCommonJsonIssues(match[0]);
  return JSON.parse(json);
}

export async function requestStructuredJson(
  prompt: string,
  options: StructuredJsonRequestOptions = {},
): Promise<unknown> {
  const result = await requestStructuredJsonWithUsage(prompt, options);
  return result.data;
}

export async function requestStructuredJsonWithUsage(
  prompt: string,
  options: StructuredJsonRequestOptions = {},
): Promise<StructuredJsonResult> {
  const taskType = options.taskType ?? "analysis";
  const aiConfig = resolveAiTaskConfig(taskType);

  if (!aiConfig.configured || !aiConfig.baseUrl || !aiConfig.apiKey || !aiConfig.model) {
    throw new Error(`AI is not configured for task ${taskType}.`);
  }

  const baseUrl = aiConfig.baseUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      authorization: `Bearer ${aiConfig.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content:
            "Return only valid JSON. Do not include markdown fences, comments, or prose outside JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI response was empty.");
  }

  return {
    data: parseStructuredJson(content),
    provider: aiConfig.provider,
    keyAlias: aiConfig.keyAlias,
    modelUsed: aiConfig.model,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
    totalTokens: body.usage?.total_tokens ?? null,
  };
}

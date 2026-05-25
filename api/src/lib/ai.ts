import { config } from "../config.js";

const DEFAULT_AI_TIMEOUT_MS = 20_000;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface StructuredJsonRequestOptions {
  timeoutMs?: number;
}

export function isAiConfigured(): boolean {
  return Boolean(
    config.AI_PROVIDER.trim() &&
    config.AI_BASE_URL.trim() &&
    config.AI_API_KEY.trim() &&
    config.AI_MODEL.trim(),
  );
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
  const baseUrl = config.AI_BASE_URL.replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      authorization: `Bearer ${config.AI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.AI_MODEL,
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

  return parseStructuredJson(content);
}

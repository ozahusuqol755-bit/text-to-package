import { config } from "../config.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function isAiConfigured(): boolean {
  return Boolean(
    config.AI_PROVIDER.trim() &&
    config.AI_BASE_URL.trim() &&
    config.AI_API_KEY.trim() &&
    config.AI_MODEL.trim(),
  );
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain JSON.");

  return JSON.parse(match[0]);
}

export async function requestStructuredJson(prompt: string): Promise<unknown> {
  const baseUrl = config.AI_BASE_URL.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
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
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI response was empty.");
  }

  return extractJson(content);
}

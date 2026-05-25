import type { PoolClient, QueryResultRow } from "pg";
import { query } from "../db.js";
import type { AiKeyAlias, AiTaskType } from "./ai.js";

export type AiUsageStatus = "success" | "error" | "fallback";

export interface AiUsageLogInput {
  taskType: AiTaskType;
  provider: string;
  modelUsed: string | null;
  keyAlias: AiKeyAlias;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
  status: AiUsageStatus;
  errorMessage?: string | null;
}

interface QueryExecutor {
  query: (text: string, params: unknown[]) => Promise<unknown>;
}

export interface AiUsageRow extends QueryResultRow {
  id: string;
  task_type: AiTaskType;
  provider: string;
  model_used: string | null;
  key_alias: AiKeyAlias;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: string | number | null;
  status: AiUsageStatus;
  error_message: string | null;
  created_at: Date;
}

export interface AiUsageSummaryBucket {
  count: number;
  total_tokens: number | null;
  estimated_cost: number | null;
}

export interface AiUsageSummary {
  by_task_type: Record<string, AiUsageSummaryBucket>;
  by_key_alias: Record<string, AiUsageSummaryBucket>;
  total_tokens: number | null;
  estimated_cost: number | null;
}

function addToBucket(
  target: Record<string, AiUsageSummaryBucket>,
  key: string,
  totalTokens: number | null,
  estimatedCost: number | null,
): void {
  target[key] ??= { count: 0, total_tokens: null, estimated_cost: null };
  target[key].count += 1;

  if (totalTokens !== null) {
    target[key].total_tokens = (target[key].total_tokens ?? 0) + totalTokens;
  }

  if (estimatedCost !== null) {
    target[key].estimated_cost = (target[key].estimated_cost ?? 0) + estimatedCost;
  }
}

function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundCost(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(8));
}

export function buildAiUsageSummary(
  rows: Array<Pick<AiUsageRow, "task_type" | "key_alias" | "total_tokens" | "estimated_cost">>,
): AiUsageSummary {
  const byTaskType: Record<string, AiUsageSummaryBucket> = {};
  const byKeyAlias: Record<string, AiUsageSummaryBucket> = {};
  let totalTokens: number | null = null;
  let estimatedCost: number | null = null;

  for (const row of rows) {
    const tokens = toNumberOrNull(row.total_tokens);
    const cost = toNumberOrNull(row.estimated_cost);

    addToBucket(byTaskType, row.task_type, tokens, cost);
    addToBucket(byKeyAlias, row.key_alias, tokens, cost);

    if (tokens !== null) totalTokens = (totalTokens ?? 0) + tokens;
    if (cost !== null) estimatedCost = (estimatedCost ?? 0) + cost;
  }

  return {
    by_task_type: Object.fromEntries(
      Object.entries(byTaskType).map(([key, value]) => [
        key,
        { ...value, estimated_cost: roundCost(value.estimated_cost) },
      ]),
    ),
    by_key_alias: Object.fromEntries(
      Object.entries(byKeyAlias).map(([key, value]) => [
        key,
        { ...value, estimated_cost: roundCost(value.estimated_cost) },
      ]),
    ),
    total_tokens: totalTokens,
    estimated_cost: roundCost(estimatedCost),
  };
}

export async function writeAiUsageLog(
  input: AiUsageLogInput,
  client?: PoolClient | QueryExecutor,
): Promise<void> {
  const execute = client ? client.query.bind(client) : query;

  await execute(
    `
      insert into ai_usage_logs (
        task_type,
        provider,
        model_used,
        key_alias,
        input_tokens,
        output_tokens,
        total_tokens,
        estimated_cost,
        status,
        error_message
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      input.taskType,
      input.provider,
      input.modelUsed,
      input.keyAlias,
      input.inputTokens ?? null,
      input.outputTokens ?? null,
      input.totalTokens ?? null,
      input.estimatedCost ?? null,
      input.status,
      input.errorMessage ?? null,
    ],
  );
}

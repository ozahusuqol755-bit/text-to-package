import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, RefreshCw, ShieldOff, Zap } from "lucide-react";
import { backendApi, type AiStatus, type AiUsageResponse } from "@/lib/backendApi";
import { EmptyState, SectionTitle, StageHeader } from "@/components/stage/StageHeader";

export const Route = createFileRoute("/ai")({ component: AiPage });

const ROLE_LABEL: Record<string, string> = {
  default: "default",
  fast: "fast",
  smart: "smart",
  write: "write",
  image: "image",
  video: "video",
};

const TASK_LABEL: Record<string, string> = {
  bulk_analysis: "bulk analysis",
  analysis: "analysis",
  idea: "idea",
  content_pack: "content pack",
  image_prompt: "image prompt",
  image_generation: "image generation",
  video_prompt: "video prompt",
  video_generation: "video generation",
};

function AiPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextStatus, nextUsage] = await Promise.all([
        backendApi.getAiStatus(),
        backendApi.getAiUsage(),
      ]);
      setStatus(nextStatus);
      setUsage(nextUsage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API недоступен");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const roleEntries = useMemo(() => (status ? Object.entries(status.roles) : []), [status]);

  return (
    <>
      <StageHeader
        step="AI"
        title="AI Status / Usage"
        description="Проверка AI routing перед подключением provider env. Ключи здесь не отображаются."
      />

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs text-muted-foreground">
          {loading ? "Обновление..." : "Status, роли и последние usage events"}
        </div>
        <button onClick={load} disabled={loading} className="chip inline-flex items-center gap-1.5">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="tg-card-inset border-destructive/40 text-sm text-destructive">{error}</div>
      ) : null}

      {status ? (
        <div className="grid grid-cols-2 gap-2">
          <StatusTile label="Mode" value={status.mode} active={status.mode === "configured"} />
          <StatusTile
            label="Base URL"
            value={status.baseUrlConfigured ? "configured" : "missing"}
            active={status.baseUrlConfigured}
          />
        </div>
      ) : null}

      <SectionTitle>Roles</SectionTitle>
      {roleEntries.length === 0 ? (
        <EmptyState>{loading ? "Загрузка AI статуса..." : "AI status недоступен."}</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {roleEntries.map(([alias, role]) => (
            <div key={alias} className="tg-card-inset">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{ROLE_LABEL[alias] ?? alias}</div>
                <span
                  className={`badge ${
                    role.configured
                      ? "bg-success/30 text-success"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {role.configured ? "ready" : "fallback"}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground break-words">
                {role.model ?? "model не задана"}
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Usage summary</SectionTitle>
      {usage ? (
        <div className="grid grid-cols-2 gap-2">
          <StatusTile
            label="Total tokens"
            value={usage.summary.total_tokens?.toLocaleString("ru") ?? "n/a"}
            active={usage.summary.total_tokens !== null}
          />
          <StatusTile
            label="Estimated cost"
            value={usage.summary.estimated_cost?.toString() ?? "n/a"}
            active={usage.summary.estimated_cost !== null}
          />
        </div>
      ) : (
        <EmptyState>{loading ? "Загрузка usage..." : "Usage пока пустой."}</EmptyState>
      )}

      {usage ? (
        <div className="mt-2 grid grid-cols-1 gap-2">
          {Object.entries(usage.summary.by_task_type).map(([task, bucket]) => (
            <div key={task} className="tg-card-inset flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold">{TASK_LABEL[task] ?? task}</div>
                <div className="text-[10px] text-muted-foreground">
                  tokens {bucket.total_tokens?.toLocaleString("ru") ?? "n/a"}
                </div>
              </div>
              <span className="badge bg-muted text-muted-foreground">{bucket.count}</span>
            </div>
          ))}
        </div>
      ) : null}

      <SectionTitle>Latest AI events</SectionTitle>
      {usage && usage.records.length > 0 ? (
        <div className="space-y-1.5">
          {usage.records.slice(0, 20).map((row) => (
            <div key={row.id} className="tg-card-inset flex gap-2.5 items-start text-xs">
              <div
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                  row.status === "success"
                    ? "bg-success/20 text-success"
                    : row.status === "error"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-warning/20 text-warning"
                }`}
              >
                {row.status === "success" ? (
                  <Zap className="size-3.5" />
                ) : (
                  <ShieldOff className="size-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <span className="badge bg-muted text-muted-foreground">{row.status}</span>
                  <span className="badge bg-muted text-muted-foreground">{row.key_alias}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {TASK_LABEL[row.task_type] ?? row.task_type}
                  </span>
                </div>
                <div className="mt-1 text-foreground/90">
                  {row.model_used ?? "fallback без model"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  tokens {row.total_tokens?.toLocaleString("ru") ?? "n/a"} ·{" "}
                  {new Date(row.created_at).toLocaleString("ru")}
                </div>
                {row.error_message ? (
                  <div className="text-[10px] text-destructive mt-0.5">{row.error_message}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>AI usage events появятся после Analysis / Idea / Content Pack.</EmptyState>
      )}
    </>
  );
}

function StatusTile({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="tg-card-inset">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Bot className={active ? "size-3.5 text-success" : "size-3.5"} />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold break-words">{value}</div>
    </div>
  );
}

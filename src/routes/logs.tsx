import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, EmptyState } from "@/components/stage/StageHeader";
import type { LogResult } from "@/types/pipeline";

export const Route = createFileRoute("/logs")({ component: LogsPage });

const STAGE_LABEL: Record<string, string> = {
  sources: "Источники",
  analysis: "Анализ",
  ideas: "Идеи",
  content_packs: "Контент-пакеты",
  packs: "Контент-пакеты",
  review: "Проверка",
  publish: "Публикация",
  metrics: "Метрики",
};

const RESULT_CLASS: Record<LogResult, string> = {
  success: "bg-success/30 text-success",
  warning: "bg-warning/30 text-warning",
  error: "bg-destructive/30 text-destructive",
};

const RESULT_LABEL: Record<LogResult, string> = {
  success: "готово",
  warning: "внимание",
  error: "ошибка",
};

const RESULT_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const ACTION_LABEL: Record<string, string> = {
  add_source: "источник добавлен",
  create_source: "источник создан",
  parse: "распарсен",
  reject: "отклонено",
  to_analysis: "→ в анализ",
  decide: "решение принято",
  create_idea: "идея создана",
  archive: "в архив",
  stop: "остановлено",
  accept: "принято",
  build_pack: "пакет собран",
  build_content_pack: "пакет собран",
  build: "пакет собран",
  rewrite_asset: "ассет переписан",
  rewrite: "отправлено на доработку",
  to_review: "→ на проверку",
  send_to_review: "→ на проверку",
  toggle_check: "чек переключён",
  approve: "согласовано",
  approve_content_pack: "согласовано",
  reject_content_pack: "отклонено",
  publish: "публикация запущена",
  retry: "повтор публикации",
  fail: "ошибка публикации",
  signal: "сигнал в анализ",
  ai_request_started: "AI запрос начат",
  ai_request_finished: "AI запрос завершён",
  ai_error: "AI ошибка",
  ai_fallback_used: "fallback AI",
  export_content_pack_markdown: "Markdown экспортирован",
  export_content_pack_markdown_failed: "Markdown export failed",
};

const LEVEL_TO_RESULT: Record<string, LogResult> = {
  success: "success",
  info: "success",
  warn: "warning",
  error: "error",
};

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("ru", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogsPage() {
  const s = usePipeline();
  const [stage, setStage] = useState<string>("all");
  const [actor, setActor] = useState<string>("all");
  const [result, setResult] = useState<string>("all");

  const stages = useMemo(() => Array.from(new Set(s.logs.map((l) => l.stage))), [s.logs]);
  const actors = useMemo(
    () => Array.from(new Set(s.logs.map((l) => l.actor).filter(Boolean))) as string[],
    [s.logs],
  );

  const filtered = s.logs.filter((l) => {
    const res = l.result ?? LEVEL_TO_RESULT[l.level] ?? "success";
    if (stage !== "all" && l.stage !== stage) return false;
    if (actor !== "all" && l.actor !== actor) return false;
    if (result !== "all" && res !== result) return false;
    return true;
  });

  return (
    <>
      <StageHeader
        step="Журнал"
        title="Audit trail всех действий"
        description="Каждое событие фиксирует actor, сущность, статус до/после и результат. Это полный след для отладки и контроля оператора."
      />

      <FilterRow
        label="Этап"
        value={stage}
        onChange={setStage}
        options={[{ k: "all", l: "все" }, ...stages.map((x) => ({ k: x, l: STAGE_LABEL[x] ?? x }))]}
      />
      <FilterRow
        label="Actor"
        value={actor}
        onChange={setActor}
        options={[{ k: "all", l: "все" }, ...actors.map((x) => ({ k: x, l: x }))]}
      />
      <FilterRow
        label="Result"
        value={result}
        onChange={setResult}
        options={[
          { k: "all", l: "все" },
          { k: "success", l: "готово" },
          { k: "warning", l: "внимание" },
          { k: "error", l: "ошибка" },
        ]}
      />

      <div className="text-[11px] text-muted-foreground mt-3 mb-1 px-1">
        Показано {filtered.length} из {s.logs.length}
      </div>

      {filtered.length === 0 ? (
        <EmptyState>Нет событий по выбранным фильтрам.</EmptyState>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log) => {
            const res = log.result ?? LEVEL_TO_RESULT[log.level] ?? "success";
            const ResultIcon = RESULT_ICON[res];
            return (
              <div key={log.id} className="tg-card-inset flex gap-2.5 items-start text-xs">
                <div
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${RESULT_CLASS[res]}`}
                >
                  <ResultIcon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`badge ${RESULT_CLASS[res]}`}>{RESULT_LABEL[res]}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {STAGE_LABEL[log.stage] ?? log.stage}
                    </span>
                    {log.action && (
                      <span className="text-[10px] font-medium text-foreground/80">
                        · {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-foreground/90">{log.message}</div>
                  {(log.status_before || log.status_after) && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      <span className="text-muted-foreground">{log.status_before ?? "—"}</span>
                      {" → "}
                      <span className="text-foreground/80">{log.status_after ?? "—"}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {log.actor ? `${log.actor} · ` : ""}
                    {log.entity_type}
                    {log.entity_id ? `:${log.entity_id}` : ""}
                    {log.job_id ? ` · job ${log.job_id}` : ""}
                    {" · "}
                    {formatTs(log.ts)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { k: string; l: string }[];
}) {
  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 px-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.k}
            onClick={() => onChange(o.k)}
            className={`chip ${value === o.k ? "bg-primary text-primary-foreground border-primary" : ""}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

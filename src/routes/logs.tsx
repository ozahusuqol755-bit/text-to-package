import { createFileRoute } from "@tanstack/react-router";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, EmptyState } from "@/components/stage/StageHeader";

export const Route = createFileRoute("/logs")({ component: LogsPage });

const STAGE_LABEL: Record<string, string> = {
  sources: "Источники",
  analysis: "Анализ",
  ideas: "Идеи",
  packs: "Пакеты",
  review: "Проверка",
  publish: "Публикация",
  metrics: "Метрики",
};

const LEVEL_CLASS: Record<string, string> = {
  info: "bg-info/30 text-info",
  success: "bg-success/30 text-success",
  warn: "bg-warning/30 text-warning",
  error: "bg-destructive/30 text-destructive",
};

function LogsPage() {
  const s = usePipeline();
  return (
    <>
      <StageHeader
        step="Журнал"
        title="Логи всех действий"
        description="Каждое действие на любом этапе создаёт видимое событие — для отладки и audit-trail."
      />
      {s.logs.length === 0 ? (
        <EmptyState>Логов пока нет.</EmptyState>
      ) : (
        <div className="space-y-1.5">
          {s.logs.map((log) => (
            <div key={log.id} className="tg-card-inset flex gap-2 items-start text-xs">
              <span className={`badge ${LEVEL_CLASS[log.level] ?? "badge-draft"}`}>
                {log.level}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground/90">{log.message}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {STAGE_LABEL[log.stage] ?? log.stage}
                  {log.action ? ` · ${log.action}` : ""}
                  {log.actor ? ` · ${log.actor}` : ""}
                  {log.entity_id ? ` · ${log.entity_id}` : ""}
                  {" · "}
                  {new Date(log.ts).toLocaleTimeString("ru")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

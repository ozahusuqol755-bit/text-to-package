import { createFileRoute, Link } from "@tanstack/react-router";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle } from "@/components/stage/StageHeader";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/analysis")({ component: AnalysisPage });

function AnalysisPage() {
  const s = usePipeline();
  const hooks = s.analyses.reduce((acc, a) => acc + (a.hook && a.hook !== "—" ? 1 : 0), 0);
  const themes = s.analyses.filter((a) => a.decision === "to_idea").length;
  const usefulness = Math.round(
    (s.analyses.reduce((acc, a) => acc + a.priority_score, 0) / Math.max(1, s.analyses.length)) * 10,
  );

  return (
    <>
      <StageHeader
        step="Этап 2 · Аналитика"
        title="Из источников вытаскиваются смыслы, паттерны и решения"
        description="Не копируем чужое. Берём паттерны: почему работает, какая боль, угол, CTA, формат, метрики и риск. На выходе — «в идеи / в архив / стоп»."
        badge={<span className="badge badge-analysis">анализ</span>}
      />

      <div className="grid grid-cols-3 gap-2">
        <Metric value={hooks} label="хуков" />
        <Metric value={themes} label="тем → идеи" />
        <Metric value={`${usefulness}%`} label="полезность" />
      </div>

      <SectionTitle>Инструменты</SectionTitle>
      <ToolsRow tools={["Claude Code", "NotebookLM", "Postgres", "Notion / Sheets"]} />

      <SectionTitle>Паттерны и решения</SectionTitle>
      <div className="space-y-2">
        {s.analyses.map((a) => {
          const src = s.sources.find((x) => x.id === a.source_id);
          return (
            <div key={a.id} className="tg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">
                    источник: {src?.title.slice(0, 32) ?? a.source_id}
                  </div>
                  <div className="font-semibold text-sm leading-snug">{a.meaning}</div>
                </div>
                <DecisionBadge d={a.decision} score={a.priority_score} />
              </div>
              {a.decision !== "stop" && (
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <Cell k="hook" v={a.hook} />
                  <Cell k="angle" v={a.angle} />
                  <Cell k="pain" v={a.pain} />
                  <Cell k="promise" v={a.promise} />
                  <Cell k="cta" v={a.cta} />
                  <Cell k="platform_fit" v={a.platform_fit.join(", ") || "—"} />
                </div>
              )}
              {a.risk_notes && a.risk_notes !== "—" && (
                <div className="text-xs text-warning mt-2">⚠ {a.risk_notes}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="tg-card mt-2">
        <div className="text-xs text-muted-foreground">Вывод анализа</div>
        <p className="text-sm mt-1">
          Ключевой угол: К/З ускоряет выпуск контента, но публикация всегда проходит через ручной approve. Из этого собирается серия идей под разные площадки.
        </p>
        <Link
          to="/ideas"
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          Сформировать идеи <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="tg-card-inset text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="text-foreground/90">{v}</div>
    </div>
  );
}

function DecisionBadge({ d, score }: { d: "to_idea" | "archive" | "stop"; score: number }) {
  if (d === "stop") return <span className="badge badge-error">стоп · {score}/10</span>;
  if (d === "archive") return <span className="badge badge-draft">архив · {score}/10</span>;
  return <span className="badge badge-idea">в идеи · {score}/10</span>;
}

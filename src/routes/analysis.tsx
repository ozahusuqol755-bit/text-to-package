import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ArrowRight, Archive, Ban, Info, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/analysis")({ component: AnalysisPage });

function AnalysisPage() {
  const s = usePipeline();
  const navigate = useNavigate();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawer = s.analyses.find((a) => a.id === drawerId) ?? null;
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
      {s.analyses.length === 0 ? (
        <EmptyState>Анализов пока нет. Отправьте источник «В анализ».</EmptyState>
      ) : (
        <div className="space-y-2">
          {s.analyses.map((a) => {
            const src = s.sources.find((x) => x.id === a.source_id);
            const stopped = a.risk_status === "stopped";
            const archived = a.risk_status === "archived";
            return (
              <div key={a.id} className={`tg-card ${stopped ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      источник: {src?.title.slice(0, 32) ?? a.source_id} · refs: {a.source_refs.join(", ")}
                    </div>
                    <div className="font-semibold text-sm leading-snug">{a.meaning}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <DecisionBadge d={a.decision} score={a.priority_score} />
                    <button onClick={() => setDrawerId(a.id)} className="text-muted-foreground hover:text-foreground" aria-label="Подробнее">
                      <Info className="size-4" />
                    </button>
                  </div>
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
                {stopped && <div className="text-xs text-destructive mt-2">⛔ risk_status = stopped</div>}
                {archived && <div className="text-xs text-muted-foreground mt-2">🗄 архив</div>}

                {!stopped && !archived && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      onClick={() => {
                        const ideaId = s.createIdeaFromAnalysis(a.id);
                        if (ideaId) {
                          toast.success("Идея создана");
                          navigate({ to: "/ideas" });
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary text-primary-foreground px-2 py-2 text-xs font-semibold"
                    >
                      <Lightbulb className="size-3.5" /> Создать идею
                    </button>
                    <button
                      onClick={() => { s.archiveAnalysis(a.id); toast("Анализ в архиве"); }}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-muted text-muted-foreground border border-border px-2 py-2 text-xs font-semibold"
                    >
                      <Archive className="size-3.5" /> В архив
                    </button>
                    <button
                      onClick={() => { s.stopAnalysis(a.id); toast.error("Анализ остановлен"); }}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/20 text-destructive border border-destructive/40 px-2 py-2 text-xs font-semibold"
                    >
                      <Ban className="size-3.5" /> Стоп
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="tg-card mt-2">
        <Link
          to="/ideas"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          Перейти к идеям <ArrowRight className="size-4" />
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

import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { usePipeline } from "@/store/PipelineStore";

const steps = [
  { id: "/sources", label: "Источники", short: "1", sub: "рефы+парс." },
  { id: "/analysis", label: "Анализ", short: "2", sub: "смыслы" },
  { id: "/ideas", label: "Идеи", short: "3", sub: "темы" },
  { id: "/packs", label: "Контент-пакеты", short: "4", sub: "ассеты" },
  { id: "/review", label: "Проверка", short: "5", sub: "approve" },
  { id: "/publish", label: "Публикация", short: "6", sub: "выход" },
  { id: "/metrics", label: "Метрики", short: "7", sub: "feedback" },
] as const;

export function PipelineHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const s = usePipeline();
  const counts: Record<(typeof steps)[number]["id"], number> = {
    "/sources": s.sources.length,
    "/analysis": s.analyses.length,
    "/ideas": s.ideas.length,
    "/packs": s.packs.length,
    "/review": s.packs.filter((p) =>
      ["ready_for_review", "approved", "rewrite_requested"].includes(p.status),
    ).length,
    "/publish": s.packs.filter((p) => ["approved", "publishing", "published"].includes(p.status))
      .length,
    "/metrics": s.metrics.length,
  };

  return (
    <header className="px-4 pt-4 pb-3 border-b border-border bg-gradient-to-br from-[oklch(0.22_0.05_260)] to-transparent">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Telegram Mini App · конвейер К/З</div>
          <h1 className="text-2xl font-bold leading-tight mt-0.5">Контент-завод</h1>
        </div>
        <div className="size-10 rounded-2xl grid place-items-center bg-success/15 text-success border border-success/30">
          <ShieldCheck className="size-5" />
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pt-3 -mx-1 px-1 scrollbar-none">
        {steps.map((step, index) => {
          const active = path === step.id;
          return (
            <div key={step.id} className="flex shrink-0 items-center">
              <Link
                to={step.id}
                aria-current={active ? "step" : undefined}
                className={`min-w-[112px] rounded-xl px-2.5 py-1.5 border transition ${
                  active
                    ? "bg-primary/25 border-primary/50 text-foreground"
                    : "bg-white/5 border-border text-muted-foreground hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold leading-tight">
                    {step.short}. {step.label}
                  </div>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {counts[step.id]}
                  </span>
                </div>
                <div className="text-[10px] opacity-80">{step.sub}</div>
              </Link>
              {index < steps.length - 1 ? (
                <ChevronRight className="mx-0.5 size-3.5 text-muted-foreground/50" />
              ) : null}
            </div>
          );
        })}
      </div>
    </header>
  );
}

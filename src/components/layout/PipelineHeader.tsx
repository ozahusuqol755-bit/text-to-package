import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

const steps = [
  { id: "/", label: "Главная", short: "0", sub: "обзор" },
  { id: "/sources", label: "Источники", short: "1", sub: "рефы+парс." },
  { id: "/analysis", label: "Анализ", short: "2", sub: "смыслы" },
  { id: "/ideas", label: "Идеи", short: "3", sub: "темы" },
  { id: "/packs", label: "Пакеты", short: "4", sub: "площадки" },
  { id: "/review", label: "Проверка", short: "5", sub: "approve" },
  { id: "/publish", label: "Выход", short: "6", sub: "публикация" },
  { id: "/metrics", label: "Метрики", short: "7", sub: "feedback" },
];

export function PipelineHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="px-4 pt-4 pb-3 border-b border-border bg-gradient-to-br from-[oklch(0.22_0.05_260)] to-transparent">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            Telegram Mini App · конвейер К/З
          </div>
          <h1 className="text-2xl font-bold leading-tight mt-0.5">
            Контент-завод
          </h1>
        </div>
        <div className="size-10 rounded-2xl grid place-items-center bg-success/15 text-success border border-success/30">
          <ShieldCheck className="size-5" />
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pt-3 -mx-1 px-1 scrollbar-none">
        {steps.map((s) => {
          const active = path === s.id;
          return (
            <Link
              key={s.id}
              to={s.id}
              className={`shrink-0 min-w-[88px] rounded-xl px-2.5 py-1.5 border transition ${
                active
                  ? "bg-primary/25 border-primary/50 text-foreground"
                  : "bg-white/5 border-border text-muted-foreground hover:bg-white/10"
              }`}
            >
              <div className="text-[13px] font-semibold leading-tight">
                {s.short}. {s.label}
              </div>
              <div className="text-[10px] opacity-80">{s.sub}</div>
            </Link>
          );
        })}
      </div>
    </header>
  );
}

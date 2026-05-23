import { createFileRoute, Link } from "@tanstack/react-router";
import { usePipeline } from "@/store/PipelineStore";
import {
  Inbox,
  Brain,
  Lightbulb,
  Package,
  ShieldCheck,
  Rocket,
  BarChart3,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Overview,
});

function Overview() {
  const s = usePipeline();
  const stages = [
    {
      to: "/sources" as const,
      Icon: Inbox,
      title: "Источники",
      sub: "рефы, тренды, документы",
      count: s.sources.length,
      hint: `${s.sources.filter((x) => x.status === "new").length} новых`,
    },
    {
      to: "/analysis" as const,
      Icon: Brain,
      title: "Анализ",
      sub: "паттерны и смыслы",
      count: s.analyses.length,
      hint: `${s.analyses.filter((x) => x.decision === "to_idea").length} → в идеи`,
    },
    {
      to: "/ideas" as const,
      Icon: Lightbulb,
      title: "Идеи",
      sub: "темы + угол + платформы",
      count: s.ideas.length,
      hint: `${s.ideas.filter((x) => x.status === "accepted").length} принято`,
    },
    {
      to: "/packs" as const,
      Icon: Package,
      title: "Контент-пакеты",
      sub: "ассеты под площадки",
      count: s.packs.length,
      hint: `${s.assets.length} ассетов`,
    },
    {
      to: "/review" as const,
      Icon: ShieldCheck,
      title: "Проверка",
      sub: "approve gate",
      count: s.packs.filter((p) => p.status === "ready_for_review").length,
      hint: "QC и финал",
    },
    {
      to: "/publish" as const,
      Icon: Rocket,
      title: "Публикация",
      sub: "n8n / DOHOO / Telegram",
      count: s.publishJobs.length,
      hint: `${s.packs.filter((p) => p.status === "published").length} опубл.`,
    },
    {
      to: "/metrics" as const,
      Icon: BarChart3,
      title: "Метрики",
      sub: "feedback loop",
      count: s.metrics.length,
      hint: "новый цикл",
    },
  ];

  return (
    <>
      <div className="tg-card">
        <div className="text-xs text-muted-foreground">Внутренний пульт оператора</div>
        <div className="font-semibold mt-0.5 leading-snug">
          Конвейер: источник → анализ → идея → пакет → approve → выход → метрики
        </div>
        <p className="text-sm text-muted-foreground/90 mt-2">
          Каждый этап имеет свой статус, действия и логи. Публикация заблокирована до ручного
          approve редактором.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stages.map(({ to, Icon, title, sub, count, hint }) => (
          <Link key={to} to={to} className="tg-card hover:bg-white/[0.08] transition group">
            <div className="flex items-start justify-between">
              <div className="size-9 rounded-xl grid place-items-center bg-primary/15 text-primary border border-primary/30">
                <Icon className="size-4" />
              </div>
              <div className="text-2xl font-bold leading-none">{count}</div>
            </div>
            <div className="mt-3 font-semibold text-sm">{title}</div>
            <div className="text-[11px] text-muted-foreground">{sub}</div>
            <div className="text-[11px] mt-2 text-info flex items-center gap-1">
              {hint} <ArrowRight className="size-3" />
            </div>
          </Link>
        ))}
      </div>

      <div className="tg-card">
        <div className="text-xs text-muted-foreground">Быстрый старт</div>
        <Link
          to="/sources"
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          Открыть очередь источников <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

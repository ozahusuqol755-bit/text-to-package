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
  CheckCircle2,
  Lock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Overview,
});

function Overview() {
  const s = usePipeline();

  // ── Pipeline state summary ────────────────────────────────────────
  const readyToPublish = s.packs.filter((p) => s.canPublish(p.id) && p.status === "approved");
  const blocked = s.packs.filter(
    (p) => p.status === "ready_for_review" || p.status === "rewrite_requested",
  );
  const onReview = s.packs.filter((p) => p.status === "ready_for_review");
  const published = s.packs.filter((p) => p.status === "published");
  const failedJobs = s.publishJobs.filter((j) => j.status === "failed");

  // ── Pick primary demo chain (latest source path) ──────────────────
  const primaryPack =
    s.packs.find((p) => p.status === "ready_for_review") ?? s.packs[0] ?? null;
  const primaryIdea = primaryPack
    ? (s.ideas.find((i) => i.id === primaryPack.idea_id) ?? null)
    : (s.ideas[0] ?? null);
  const primaryAnalysis = primaryIdea
    ? (s.analyses.find((a) => a.id === primaryIdea.analysis_id) ?? null)
    : (s.analyses[0] ?? null);
  const primarySource = primaryAnalysis
    ? (s.sources.find((src) => src.id === primaryAnalysis.source_id) ?? null)
    : (s.sources[0] ?? null);
  const primaryChecks = primaryPack
    ? s.reviewChecks.filter((c) => c.pack_id === primaryPack.id)
    : [];
  const primaryMetric = primaryPack
    ? (s.metrics.find((m) => m.pack_id === primaryPack.id) ?? null)
    : (s.metrics[0] ?? null);

  // ── Next operator action ──────────────────────────────────────────
  let nextAction: { label: string; to: "/sources" | "/analysis" | "/ideas" | "/packs" | "/review" | "/publish" | "/metrics"; hint: string };
  if (failedJobs.length > 0) {
    nextAction = {
      label: "Повторить публикацию",
      to: "/publish",
      hint: `${failedJobs.length} job с ошибкой — нужен retry`,
    };
  } else if (readyToPublish.length > 0) {
    nextAction = {
      label: "Опубликовать пакет",
      to: "/publish",
      hint: `${readyToPublish.length} пакет(ов) согласовано и готово к выходу`,
    };
  } else if (onReview.length > 0) {
    nextAction = {
      label: "Проверить и согласовать",
      to: "/review",
      hint: `${onReview.length} пакет(ов) ждут approve gate`,
    };
  } else if (s.ideas.some((i) => i.status === "accepted")) {
    nextAction = {
      label: "Собрать контент-пакет",
      to: "/ideas",
      hint: "Принятая идея готова к производству",
    };
  } else {
    nextAction = {
      label: "Открыть очередь источников",
      to: "/sources",
      hint: "Начните цикл с нового источника",
    };
  }

  const chain: Array<{
    to: "/sources" | "/analysis" | "/ideas" | "/packs" | "/review" | "/publish" | "/metrics";
    Icon: typeof Inbox;
    label: string;
    value: string;
    state: "done" | "active" | "blocked" | "pending";
  }> = [
    {
      to: "/sources",
      Icon: Inbox,
      label: "Источник",
      value: primarySource?.title.slice(0, 38) ?? "—",
      state: primarySource ? "done" : "pending",
    },
    {
      to: "/analysis",
      Icon: Brain,
      label: "Анализ",
      value: primaryAnalysis ? `${primaryAnalysis.patterns.length} паттернов` : "—",
      state: primaryAnalysis ? "done" : "pending",
    },
    {
      to: "/ideas",
      Icon: Lightbulb,
      label: "Идея",
      value: primaryIdea?.topic.slice(0, 38) ?? "—",
      state: primaryIdea ? "done" : "pending",
    },
    {
      to: "/packs",
      Icon: Package,
      label: "Пакет",
      value: primaryPack
        ? `${s.assets.filter((a) => a.pack_id === primaryPack.id).length} ассетов`
        : "—",
      state: primaryPack ? "done" : "pending",
    },
    {
      to: "/review",
      Icon: ShieldCheck,
      label: "Проверка",
      value: primaryPack
        ? `${primaryChecks.filter((c) => c.passed).length}/${primaryChecks.length} чеков`
        : "—",
      state: !primaryPack
        ? "pending"
        : primaryPack.status === "approved"
          ? "done"
          : primaryPack.status === "ready_for_review"
            ? "active"
            : primaryPack.status === "rewrite_requested"
              ? "blocked"
              : "done",
    },
    {
      to: "/publish",
      Icon: Rocket,
      label: "Публикация",
      value: !primaryPack
        ? "—"
        : primaryPack.status === "published"
          ? "опубликовано"
          : primaryPack.status === "approved"
            ? "готово к публикации"
            : "заблокировано",
      state: !primaryPack
        ? "pending"
        : primaryPack.status === "published"
          ? "done"
          : primaryPack.status === "approved"
            ? "active"
            : "blocked",
    },
    {
      to: "/metrics",
      Icon: BarChart3,
      label: "Метрики",
      value: primaryMetric
        ? `${primaryMetric.views ?? 0} просм.`
        : "ждём данные",
      state: primaryMetric ? "done" : "pending",
    },
  ];

  return (
    <>
      {/* ── Hero / operator state ─────────────────────────────────── */}
      <div className="tg-card bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
        <div className="flex items-start gap-2">
          <div className="size-9 rounded-xl grid place-items-center bg-primary/25 text-primary border border-primary/40 shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">
              Пульт оператора · AI Content Factory
            </div>
            <div className="font-semibold leading-snug">
              Один цикл: источник → анализ → идея → пакет → проверка → публикация → метрики
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <StateCell
            tone="success"
            value={readyToPublish.length}
            label="Готово к публикации"
            Icon={CheckCircle2}
          />
          <StateCell
            tone="warn"
            value={onReview.length}
            label="На проверке"
            Icon={ShieldCheck}
          />
          <StateCell
            tone="error"
            value={blocked.length}
            label="Заблокировано"
            Icon={Lock}
          />
          <StateCell
            tone="info"
            value={failedJobs.length}
            label="Нужно внимание"
            Icon={AlertTriangle}
          />
        </div>

        <Link
          to={nextAction.to}
          className="mt-3 w-full inline-flex items-center justify-between gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          <div className="text-left min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-primary-foreground/70">
              Следующий шаг
            </div>
            <div className="text-sm truncate">{nextAction.label}</div>
          </div>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
        <div className="mt-1.5 text-[11px] text-muted-foreground px-1">{nextAction.hint}</div>
      </div>

      {/* ── Demo scenario chain ──────────────────────────────────── */}
      <div className="tg-card">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Демо-цепочка
          </div>
          <span className="badge badge-info">в работе</span>
        </div>
        <div className="font-semibold text-sm mt-0.5">
          {primaryIdea?.topic ?? "Сценарий: один материал через все этапы"}
        </div>

        <div className="mt-3 space-y-1.5">
          {chain.map((step, i) => (
            <Link
              key={step.to + i}
              to={step.to}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${
                step.state === "done"
                  ? "border-success/30 bg-success/10"
                  : step.state === "active"
                    ? "border-primary/40 bg-primary/15"
                    : step.state === "blocked"
                      ? "border-warning/40 bg-warning/10"
                      : "border-border bg-black/15"
              }`}
            >
              <div
                className={`size-7 rounded-lg grid place-items-center shrink-0 ${
                  step.state === "done"
                    ? "bg-success/25 text-success"
                    : step.state === "active"
                      ? "bg-primary/25 text-primary"
                      : step.state === "blocked"
                        ? "bg-warning/25 text-warning"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                <step.Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
                  {i + 1}. {step.label}
                </div>
                <div className="text-xs font-medium truncate mt-0.5">{step.value}</div>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0">
                {step.state === "done"
                  ? "✓"
                  : step.state === "active"
                    ? "сейчас"
                    : step.state === "blocked"
                      ? "ждёт"
                      : "—"}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Stage counts grid (compact) ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <StageTile
          to="/sources"
          Icon={Inbox}
          title="Источники"
          count={s.sources.length}
          hint={`${s.sources.filter((x) => x.status === "new").length} новых`}
        />
        <StageTile
          to="/analysis"
          Icon={Brain}
          title="Анализ"
          count={s.analyses.length}
          hint={`${s.analyses.filter((x) => x.decision === "to_idea").length} → в идеи`}
        />
        <StageTile
          to="/ideas"
          Icon={Lightbulb}
          title="Идеи"
          count={s.ideas.length}
          hint={`${s.ideas.filter((x) => x.status === "accepted").length} принято`}
        />
        <StageTile
          to="/packs"
          Icon={Package}
          title="Пакеты"
          count={s.packs.length}
          hint={`${s.assets.length} ассетов`}
        />
        <StageTile
          to="/review"
          Icon={ShieldCheck}
          title="Проверка"
          count={onReview.length}
          hint="approve gate"
        />
        <StageTile
          to="/publish"
          Icon={Rocket}
          title="Публикация"
          count={s.publishJobs.length}
          hint={`${published.length} опубл.`}
        />
      </div>
    </>
  );
}

function StateCell({
  tone,
  value,
  label,
  Icon,
}: {
  tone: "success" | "warn" | "error" | "info";
  value: number;
  label: string;
  Icon: typeof CheckCircle2;
}) {
  const toneCls =
    tone === "success"
      ? "bg-success/10 border-success/30 text-success"
      : tone === "warn"
        ? "bg-warning/10 border-warning/30 text-warning"
        : tone === "error"
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : "bg-info/10 border-info/30 text-info";
  return (
    <div className={`rounded-xl border ${toneCls} px-2.5 py-2`}>
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5" />
        <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      </div>
      <div className="text-2xl font-bold leading-none mt-1 text-foreground">{value}</div>
    </div>
  );
}

function StageTile({
  to,
  Icon,
  title,
  count,
  hint,
}: {
  to: "/sources" | "/analysis" | "/ideas" | "/packs" | "/review" | "/publish" | "/metrics";
  Icon: typeof Inbox;
  title: string;
  count: number;
  hint: string;
}) {
  return (
    <Link to={to} className="tg-card hover:bg-white/[0.08] transition">
      <div className="flex items-start justify-between">
        <div className="size-8 rounded-lg grid place-items-center bg-primary/15 text-primary border border-primary/30">
          <Icon className="size-4" />
        </div>
        <div className="text-xl font-bold leading-none">{count}</div>
      </div>
      <div className="mt-2 font-semibold text-xs">{title}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </Link>
  );
}

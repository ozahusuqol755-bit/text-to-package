import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/review")({ component: ReviewPage });

function ReviewPage() {
  const s = usePipeline();
  const reviewable = s.packs.filter(
    (p) => p.status === "ready_for_review" || p.status === "approved" || p.status === "rewrite_requested",
  );

  return (
    <>
      <StageHeader
        step="Этап 5 · Контроль"
        title="QC, Codex review и approve gate"
        description="Перед выходом проверяется смысл, факты, тон бренда, оригинальность, соответствие площадке и риск копирования. Без approve публикация заблокирована."
        badge={<span className="badge badge-warn">проверка</span>}
      />

      <ToolsRow tools={["Codex — контролёр", "Claude Code", "Postgres", "Notion / Sheets"]} />

      {reviewable.length === 0 ? (
        <EmptyState>Нет пакетов на проверку.</EmptyState>
      ) : (
        reviewable.map((pack) => {
          const checks = s.reviewChecks.filter((c) => c.pack_id === pack.id);
          const assets = s.assets.filter((a) => a.pack_id === pack.id);
          const avgQc = Math.round(
            assets.reduce((acc, a) => acc + (a.qc_score ?? 0), 0) / Math.max(1, assets.length),
          );
          const criticalRisks = checks.filter((c) => !c.passed).length;
          return (
            <div key={pack.id} className="space-y-2">
              <div className="tg-card">
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <div className="text-[11px] text-muted-foreground">пакет</div>
                    <div className="font-semibold text-sm">{pack.title}</div>
                  </div>
                  <StatusBadge status={pack.status} />
                </div>
                {pack.approved_by && (
                  <div className="text-xs text-success mt-2">
                    Одобрено: {pack.approved_by}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Stat value={avgQc} label="QC score" />
                <Stat value={assets.length} label="ассетов" />
                <Stat value={criticalRisks} label="крит. рисков" tone={criticalRisks ? "warn" : "ok"} />
              </div>

              <SectionTitle>Checklist</SectionTitle>
              <div className="tg-card space-y-2.5">
                {checks.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className={`mt-0.5 size-4 rounded-full grid place-items-center ${c.passed ? "bg-success/30 text-success" : "bg-destructive/30 text-destructive"}`}>
                      {c.passed ? <Check className="size-3" /> : <X className="size-3" />}
                    </div>
                    <div className="text-sm">{c.label}</div>
                  </div>
                ))}
                <div className="flex items-start gap-2 pt-1 border-t border-border">
                  <div className={`mt-0.5 size-4 rounded-full grid place-items-center ${pack.status === "approved" ? "bg-success/30 text-success" : "bg-warning/30 text-warning"}`}>
                    {pack.status === "approved" ? <Check className="size-3" /> : <X className="size-3" />}
                  </div>
                  <div className="text-sm">
                    Hard rule: <code className="text-info">status === "approved" &amp;&amp; approved_by</code>
                  </div>
                </div>
              </div>

              {pack.status !== "approved" ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { s.rejectPack(pack.id); toast.error("Пакет отклонён"); }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/20 text-destructive border border-destructive/40 px-2 py-2.5 text-sm font-semibold"
                  >
                    <X className="size-4" /> Отклонить
                  </button>
                  <button
                    onClick={() => { s.requestRewrite(pack.id); toast("Запрошен rewrite"); }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-warning/20 text-warning border border-warning/40 px-2 py-2.5 text-sm font-semibold"
                  >
                    <RefreshCw className="size-4" /> Rewrite
                  </button>
                  <button
                    onClick={() => { s.approvePack(pack.id, "editor@kz"); toast.success("Пакет одобрен. Публикация разблокирована."); }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-success/30 text-success border border-success/50 px-2 py-2.5 text-sm font-semibold"
                  >
                    <Check className="size-4" /> Approve
                  </button>
                </div>
              ) : (
                <Link
                  to="/publish"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
                >
                  К публикации <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          );
        })
      )}
    </>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "ok" | "warn" }) {
  return (
    <div className="tg-card-inset text-center">
      <div className={`text-xl font-bold ${tone === "warn" ? "text-warning" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

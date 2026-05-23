import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { ArrowRight, Check, Lock, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/review")({ component: ReviewPage });

function ReviewPage() {
  const s = usePipeline();
  const reviewable = s.packs.filter(
    (p) =>
      p.status === "ready_for_review" ||
      p.status === "approved" ||
      p.status === "rewrite_requested",
  );

  return (
    <>
      <StageHeader
        step="Этап 5 · Контроль"
        title="QC, Codex review и approve gate"
        description="Перед выходом проверяется смысл, факты, тон бренда, оригинальность, соответствие площадке и риск копирования. Approve открывается только после всех обязательных чек-боксов."
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
          const requiredPending = checks.filter((c) => c.required && !c.passed).length;
          const canApprove = s.canApprove(pack.id);
          return (
            <div key={pack.id} className="space-y-2">
              <div className="tg-card">
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <div className="text-[11px] text-muted-foreground">пакет {pack.id}</div>
                    <div className="font-semibold text-sm">{pack.title}</div>
                  </div>
                  <StatusBadge status={pack.status} />
                </div>
                {pack.approved_by && (
                  <div className="text-xs text-success mt-2">
                    Одобрено: {pack.approved_by} ·{" "}
                    {pack.approved_at ? new Date(pack.approved_at).toLocaleTimeString("ru") : ""}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Stat value={avgQc} label="QC score" />
                <Stat value={assets.length} label="ассетов" />
                <Stat
                  value={requiredPending}
                  label="обяз. ещё"
                  tone={requiredPending ? "warn" : "ok"}
                />
              </div>

              <SectionTitle>Checklist (интерактивный)</SectionTitle>
              <div className="tg-card space-y-2">
                {checks.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => s.toggleCheck(c.id)}
                    disabled={pack.status === "approved"}
                    className="w-full flex items-start gap-2 text-left py-1 disabled:opacity-60"
                  >
                    <div
                      className={`mt-0.5 size-5 rounded-md grid place-items-center border ${c.passed ? "bg-success/30 text-success border-success/50" : "bg-black/30 border-border text-muted-foreground"}`}
                    >
                      {c.passed ? <Check className="size-3" /> : null}
                    </div>
                    <div className="text-sm flex-1">
                      {c.label}
                      {c.required && (
                        <span className="ml-1 text-[10px] text-destructive">обяз.</span>
                      )}
                    </div>
                  </button>
                ))}
                <div className="flex items-start gap-2 pt-2 border-t border-border text-xs">
                  <div
                    className={`mt-0.5 size-4 rounded-full grid place-items-center ${canApprove ? "bg-success/30 text-success" : "bg-warning/30 text-warning"}`}
                  >
                    {canApprove ? <Check className="size-3" /> : <Lock className="size-3" />}
                  </div>
                  <div className="text-muted-foreground">
                    Gate: <code className="text-info">все обязательные пункты ✓</code>
                  </div>
                </div>
              </div>

              {pack.status !== "approved" ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      s.rejectPack(pack.id);
                      toast.error("Пакет отклонён");
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/20 text-destructive border border-destructive/40 px-2 py-2.5 text-sm font-semibold"
                  >
                    <X className="size-4" /> Reject
                  </button>
                  <button
                    onClick={() => {
                      s.requestRewrite(pack.id);
                      toast("Запрошен rewrite");
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-warning/20 text-warning border border-warning/40 px-2 py-2.5 text-sm font-semibold"
                  >
                    <RefreshCw className="size-4" /> Rewrite
                  </button>
                  <button
                    disabled={!canApprove}
                    onClick={() => {
                      s.approvePack(pack.id);
                      if (s.canApprove(pack.id))
                        toast.success("Approved. Публикация разблокирована.");
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-success/30 text-success border border-success/50 px-2 py-2.5 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {canApprove ? <Check className="size-4" /> : <Lock className="size-4" />}{" "}
                    Approve
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

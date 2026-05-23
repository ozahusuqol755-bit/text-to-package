import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ArrowRight, Info, Lock, RefreshCw, Rocket } from "lucide-react";

export const Route = createFileRoute("/publish")({ component: PublishPage });

function PublishPage() {
  const s = usePipeline();
  const [jobDrawerId, setJobDrawerId] = useState<string | null>(null);
  const jobDrawer = s.publishJobs.find((j) => j.id === jobDrawerId) ?? null;
  const visible = s.packs.filter((p) => p.status !== "draft" && p.status !== "ready_for_review" && p.status !== "rejected" && p.status !== "rewrite_requested");

  return (
    <>
      <StageHeader
        step="Этап 6 · Выход"
        title="Публикация, расписание и логирование"
        description="После approve запускается n8n / DOHOO: отправить посты, поставить в расписание, записать логи. Каждый job имеет id, attempts и статус."
        badge={
          visible.length > 0 ? (
            <span className="badge badge-success">готово к выходу</span>
          ) : (
            <span className="badge badge-error">нет approve</span>
          )
        }
      />

      <ToolsRow tools={["n8n", "DOHOO", "Telegram Bot", "Postgres", "Claude Code Channel"]} />

      {s.packs.filter((p) => ["approved", "publishing", "published"].includes(p.status)).length === 0 && (
        <EmptyState>Нет пакетов, прошедших approve.</EmptyState>
      )}

      {s.packs.map((pack) => {
        const canPub = s.canPublish(pack.id);
        const jobs = s.publishJobs.filter((j) => j.pack_id === pack.id);
        const assets = s.assets.filter((a) => a.pack_id === pack.id);
        if (!["approved", "publishing", "published"].includes(pack.status)) return null;
        return (
          <div key={pack.id} className="space-y-2">
            <div className="tg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">pack {pack.id}</div>
                  <div className="font-semibold text-sm">{pack.title}</div>
                  <div className={`text-xs mt-1 ${pack.approved_by ? "text-success" : "text-warning"}`}>
                    approved_by: {pack.approved_by ?? "null"}
                  </div>
                </div>
                <StatusBadge status={pack.status} />
              </div>

              <button
                disabled={!canPub || pack.status !== "approved"}
                onClick={() => { s.publishPack(pack.id); toast.success("n8n / DOHOO: публикация запущена"); }}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {canPub && pack.status === "approved" ? (
                  <><Rocket className="size-4" /> Опубликовать через n8n / DOHOO</>
                ) : pack.status === "publishing" ? (
                  <>Публикация…</>
                ) : pack.status === "published" ? (
                  <>Опубликовано</>
                ) : (
                  <><Lock className="size-4" /> Заблокировано — нет approve</>
                )}
              </button>
            </div>

            <SectionTitle>Jobs (n8n / DOHOO / Telegram Bot)</SectionTitle>
            <div className="tg-card-inset overflow-hidden">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Канал</th>
                    <th className="text-left">Тул</th>
                    <th className="text-left">Попыт.</th>
                    <th className="text-left">Статус</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const job = jobs.find((j) => j.asset_id === a.id);
                    return (
                      <tr key={a.id} className="border-b border-border/40 last:border-0 align-top">
                        <td className="py-2 pr-2">{a.platform}</td>
                        <td className="pr-2">{job?.tool ?? (canPub ? "n8n" : "—")}</td>
                        <td className="pr-2">{job?.attempts ?? "—"}</td>
                        <td className="pr-2">
                          {job ? <StatusBadge status={job.status} /> : <span className="text-muted-foreground">—</span>}
                          {job?.error && <div className="text-[10px] text-destructive mt-1">{job.error}</div>}
                        </td>
                        <td>
                          {job && (
                            <button
                              onClick={() => setJobDrawerId(job.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground border border-border px-1.5 py-1 text-[10px] font-semibold mr-1"
                              aria-label="Подробнее"
                            >
                              <Info className="size-3" />
                            </button>
                          )}
                          {job?.status === "failed" && (
                            <button
                              onClick={() => { s.retryPublishJob(job.id); toast("Retry…"); }}
                              className="inline-flex items-center gap-1 rounded-md bg-warning/20 text-warning border border-warning/40 px-1.5 py-1 text-[10px] font-semibold"
                            >
                              <RefreshCw className="size-3" /> retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pack.status === "published" && (
              <Link
                to="/metrics"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-success/20 text-success border border-success/40 px-4 py-3 font-semibold"
              >
                Смотреть метрики <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        );
      })}

      <SectionTitle>Правила безопасности</SectionTitle>
      <div className="tg-card text-xs space-y-1.5 text-muted-foreground">
        <div>• Публикация запрещена без status === "approved"</div>
        <div>• approved_by обязателен</div>
        <div>• Каждый шаг получает job_id, attempts, и логируется</div>
        <div>• failed job можно повторить (retry)</div>
      </div>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { ArrowRight, Lock, Rocket } from "lucide-react";

export const Route = createFileRoute("/publish")({ component: PublishPage });

function PublishPage() {
  const s = usePipeline();
  const ready = s.packs.filter((p) => ["approved", "scheduled", "publishing", "published"].includes(p.status));

  return (
    <>
      <StageHeader
        step="Этап 6 · Выход"
        title="Публикация, расписание и логирование"
        description="После approve запускается n8n / DOHOO: отправить посты, поставить в расписание, записать логи. Каждый job имеет id и статус."
        badge={
          ready.length > 0 ? (
            <span className="badge badge-success">готово к выходу</span>
          ) : (
            <span className="badge badge-error">заблокировано</span>
          )
        }
      />

      <ToolsRow tools={["n8n", "DOHOO", "Telegram Bot", "Postgres", "Claude Code Channel"]} />

      {s.packs.filter((p) => p.status !== "draft").length === 0 && (
        <EmptyState>Пока нет пакетов на выходе.</EmptyState>
      )}

      {s.packs.map((pack) => {
        const canPub = s.canPublish(pack.id);
        const jobs = s.publishJobs.filter((j) => j.pack_id === pack.id);
        const assets = s.assets.filter((a) => a.pack_id === pack.id);
        return (
          <div key={pack.id} className="space-y-2">
            <div className="tg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">
                    pack {pack.id}
                  </div>
                  <div className="font-semibold text-sm">{pack.title}</div>
                  {pack.approved_by ? (
                    <div className="text-xs text-success mt-1">
                      approved_by: {pack.approved_by}
                    </div>
                  ) : (
                    <div className="text-xs text-warning mt-1">approved_by: null</div>
                  )}
                </div>
                <StatusBadge status={pack.status} />
              </div>

              <button
                disabled={!canPub || pack.status !== "approved"}
                onClick={() => { s.publishPack(pack.id); toast.success("n8n / DOHOO: публикация запущена"); }}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {canPub && pack.status === "approved" ? (
                  <>
                    <Rocket className="size-4" /> Опубликовать через n8n / DOHOO
                  </>
                ) : pack.status === "scheduled" || pack.status === "publishing" ? (
                  <>Публикация…</>
                ) : pack.status === "published" ? (
                  <>Опубликовано</>
                ) : (
                  <>
                    <Lock className="size-4" /> Заблокировано — нет approve
                  </>
                )}
              </button>
              {!canPub && pack.status !== "published" && (
                <div className="text-xs text-warning mt-2">
                  ⚠ Hard rule: status === "approved" && approved_by != null
                </div>
              )}
            </div>

            <SectionTitle>План выхода</SectionTitle>
            <div className="tg-card-inset overflow-hidden">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Ассет</th>
                    <th className="text-left">Канал</th>
                    <th className="text-left">Тул</th>
                    <th className="text-left">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const job = jobs.find((j) => j.asset_id === a.id);
                    return (
                      <tr key={a.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-2">{a.format}</td>
                        <td className="pr-2">{a.platform}</td>
                        <td className="pr-2">{job?.tool ?? (canPub ? "n8n" : "—")}</td>
                        <td>
                          {job ? <StatusBadge status={job.status} /> : <span className="text-muted-foreground">—</span>}
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
        <div>• Каждый шаг получает job_id и логируется</div>
        <div>• failed step можно повторить</div>
        <div>• Опасные действия — только после подтверждения</div>
      </div>
    </>
  );
}

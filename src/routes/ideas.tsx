import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ArrowRight, Check, Info, Package, X } from "lucide-react";

export const Route = createFileRoute("/ideas")({ component: IdeasPage });

function IdeasPage() {
  const s = usePipeline();
  const navigate = useNavigate();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawer = s.ideas.find((i) => i.id === drawerId) ?? null;

  return (
    <>
      <StageHeader
        step="Этап 3 · Планирование"
        title="Идеи комплектуются из смыслов"
        description="Идея — ещё не пост. Это тема + угол + источники + платформы + приоритет + теги. Из одной идеи дальше собирается контент-пакет."
        badge={<span className="badge badge-idea">идеи</span>}
      />

      <ToolsRow tools={["Claude Code Channel — Telegram-пульт", "Claude Code", "Postgres"]} />

      {s.ideas.length === 0 ? (
        <EmptyState>Идей пока нет.</EmptyState>
      ) : (
        <div className="space-y-2">
          {s.ideas.map((i) => {
            const hasPack = s.packs.some((p) => p.idea_id === i.id);
            return (
              <div key={i.id} className="tg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      #{i.id.slice(-3)} · приоритет {i.priority} · score {i.priority_score}
                    </div>
                    <div className="font-semibold text-sm leading-snug">{i.topic}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={i.status} />
                    <button
                      onClick={() => setDrawerId(i.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Подробнее"
                    >
                      <Info className="size-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Угол: {i.angle}. Источники: {i.source_refs.join(", ") || "—"}.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {i.platform_targets.map((p) => (
                    <span key={p} className="chip">
                      {p}
                    </span>
                  ))}
                  {i.tags.map((t) => (
                    <span key={t} className="chip chip-tool">
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {i.status !== "accepted" && i.status !== "in_pack" ? (
                    <button
                      onClick={() => {
                        s.acceptIdea(i.id);
                        toast.success("Идея принята");
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-success/20 text-success border border-success/40 px-3 py-2 text-sm font-semibold"
                    >
                      <Check className="size-4" /> Принять
                    </button>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-success/10 text-success border border-success/30 px-3 py-2 text-sm">
                      <Check className="size-4" /> {i.status === "in_pack" ? "В пакете" : "Принята"}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      s.rejectIdea(i.id);
                      toast("Идея отклонена");
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/20 text-destructive border border-destructive/40 px-3 py-2 text-sm font-semibold"
                  >
                    <X className="size-4" /> Отклонить
                  </button>
                </div>
                {(i.status === "accepted" || i.status === "in_pack") && (
                  <button
                    onClick={() => {
                      const packId = s.buildPackFromIdea(i.id);
                      if (packId) {
                        toast.success(hasPack ? "Пакет открыт" : "Контент-пакет собран");
                        navigate({ to: "/packs" });
                      }
                    }}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
                  >
                    <Package className="size-4" />
                    {hasPack ? "Открыть пакет" : "Собрать контент-пакет"}
                    <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SectionTitle>Поток</SectionTitle>
      <div className="tg-card-inset text-xs text-muted-foreground text-center">
        Идея → пакет материалов под 9 площадок
      </div>

      <DetailDrawer
        open={!!drawer}
        onClose={() => setDrawerId(null)}
        kind="Идея"
        id={drawer?.id ?? ""}
        title={drawer?.topic ?? ""}
        status={drawer?.status ?? ""}
        body={drawer?.angle}
        refs={
          drawer
            ? [
                {
                  label: "приоритет",
                  value: `${drawer.priority} · score ${drawer.priority_score}`,
                },
                { label: "source_refs", value: drawer.source_refs.join(", ") || "—" },
                { label: "platforms", value: drawer.platform_targets.join(", ") },
                { label: "tags", value: drawer.tags.join(", ") || "—" },
                { label: "pack", value: s.packs.find((p) => p.idea_id === drawer.id)?.id ?? "—" },
              ]
            : []
        }
        nextActions={
          drawer
            ? [
                {
                  label: "Принять",
                  onClick: () => {
                    s.acceptIdea(drawer.id);
                    toast.success("Идея принята");
                  },
                  variant: "primary",
                  disabled: drawer.status === "accepted" || drawer.status === "in_pack",
                },
                {
                  label: "Собрать пакет",
                  onClick: () => {
                    const id = s.buildPackFromIdea(drawer.id);
                    if (id) {
                      toast.success("Пакет готов");
                      navigate({ to: "/packs" });
                    }
                  },
                  variant: "muted",
                  disabled: drawer.status !== "accepted" && drawer.status !== "in_pack",
                },
                {
                  label: "Отклонить",
                  onClick: () => {
                    s.rejectIdea(drawer.id);
                    toast("Идея отклонена");
                  },
                  variant: "danger",
                },
              ]
            : []
        }
      />
    </>
  );
}

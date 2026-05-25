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

  async function generateContentPack(ideaId: string) {
    if (s.apiMode === "ready") {
      await s.createContentPackViaBackend(ideaId);
      toast.success("Контент-пакет создан");
      navigate({ to: "/packs" });
      return;
    }

    const packId = s.buildPackFromIdea(ideaId);
    if (packId) {
      toast.success("Контент-пакет собран");
      navigate({ to: "/packs" });
    }
  }

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
            const payload = i.idea_payload ?? {};
            return (
              <div key={i.id} className="tg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      #{i.id.slice(-3)} · приоритет {i.priority} · score {i.priority_score}
                    </div>
                    <div className="font-semibold text-sm leading-snug">
                      {payload.title ?? i.topic}
                    </div>
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
                  Thesis: {payload.thesis ?? i.angle}. Источники: {i.source_refs.join(", ") || "—"}.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <IdeaCell k="format" v={payload.format ?? "—"} />
                  <IdeaCell k="platform" v={payload.platform ?? "—"} />
                  <IdeaCell k="hook" v={payload.hook ?? i.topic} />
                  <IdeaCell k="adaptation_note" v={payload.adaptation_note ?? "—"} />
                </div>
                {payload.outline && payload.outline.length > 0 && (
                  <div className="mt-2 text-xs">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      outline
                    </div>
                    <div className="text-foreground/90">{payload.outline.join(" · ")}</div>
                  </div>
                )}
                {payload.risk_to_check && (
                  <div className="mt-2 text-xs text-warning">
                    Risk to check: {payload.risk_to_check}
                  </div>
                )}
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
                {(i.status === "accepted" || i.status === "in_pack" || s.apiMode === "ready") && (
                  <button
                    onClick={() => void generateContentPack(i.id)}
                    disabled={s.apiAction === "create_content_pack_from_idea"}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    <Package className="size-4" />
                    {hasPack ? "Открыть пакет" : "Generate content pack"}
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
        body={drawer?.idea_payload?.thesis ?? drawer?.angle}
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
                { label: "format", value: drawer.idea_payload?.format ?? "—" },
                { label: "platform", value: drawer.idea_payload?.platform ?? "—" },
                { label: "hook", value: drawer.idea_payload?.hook ?? "—" },
                { label: "outline", value: drawer.idea_payload?.outline?.join(" · ") ?? "—" },
                {
                  label: "adaptation_note",
                  value: drawer.idea_payload?.adaptation_note ?? "—",
                },
                { label: "risk_to_check", value: drawer.idea_payload?.risk_to_check ?? "—" },
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
                  label: "Generate content pack",
                  onClick: () => void generateContentPack(drawer.id),
                  variant: "muted",
                  disabled:
                    s.apiAction === "create_content_pack_from_idea" ||
                    (s.apiMode !== "ready" &&
                      drawer.status !== "accepted" &&
                      drawer.status !== "in_pack"),
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

function IdeaCell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="text-foreground/90">{v}</div>
    </div>
  );
}

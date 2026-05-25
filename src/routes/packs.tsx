import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { DetailDrawer } from "@/components/DetailDrawer";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Hash,
  Info,
  Lock,
  RefreshCw,
  Send,
} from "lucide-react";

export const Route = createFileRoute("/packs")({ component: PacksPage });

const PLATFORM_LABEL: Record<string, string> = {
  telegram: "Telegram-пост",
  threads: "Threads-пост",
  x: "X-пост",
  vk: "VK-пост",
  instagram: "Instagram caption",
  reels: "Reels сценарий",
  tiktok: "TikTok сценарий",
  image: "Картинка (prompt)",
  video: "Видео-бриф",
};

function PacksPage() {
  const s = usePipeline();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [packDrawerId, setPackDrawerId] = useState<string | null>(null);
  const [assetDrawerId, setAssetDrawerId] = useState<string | null>(null);
  const packDrawer = s.packs.find((p) => p.id === packDrawerId) ?? null;
  const assetDrawer = s.assets.find((a) => a.id === assetDrawerId) ?? null;

  return (
    <>
      <StageHeader
        step="Этап 4 · Производство"
        title="Контент-пакет: тексты, картинка, видео"
        description="Одна идея → комплект под Telegram, Threads, X, VK, Instagram, Reels, TikTok, image-prompt и video-бриф. У каждого ассета своя версия и статус."
        badge={<span className="badge badge-draft">черновики</span>}
      />

      <ToolsRow tools={["Claude Code", "n8n", "Vizard", "CapCut", "Postgres"]} />

      {s.packs.length === 0 ? (
        <EmptyState>Контент-пакетов пока нет. Соберите из идеи.</EmptyState>
      ) : (
        s.packs.map((pack) => {
          const idea = s.ideas.find((i) => i.id === pack.idea_id);
          const assets = s.assets.filter((a) => a.pack_id === pack.id);
          const checks = s.reviewChecks.filter((c) => c.pack_id === pack.id);
          const approvedReady = pack.status === "approved" && pack.approved_by && pack.approved_at;
          return (
            <div key={pack.id} className="space-y-2">
              <div className="tg-card overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Hash className="size-3" />
                      <span className="truncate">идея: {idea?.topic.slice(0, 44) ?? "—"}</span>
                    </div>
                    <div className="mt-1 font-semibold text-sm leading-snug">{pack.title}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={pack.status} />
                    <button
                      onClick={() => setPackDrawerId(pack.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Подробнее"
                    >
                      <Info className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
                  <div className="rounded-lg border border-border bg-black/15 px-2 py-1.5">
                    <div className="text-muted-foreground">Ассеты</div>
                    <div className="font-semibold">{assets.length}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-black/15 px-2 py-1.5">
                    <div className="text-muted-foreground">Версия</div>
                    <div className="font-semibold">
                      v{Math.max(1, ...assets.map((a) => a.version))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-black/15 px-2 py-1.5">
                    <div className="text-muted-foreground">Чеки</div>
                    <div className="font-semibold">
                      {checks.filter((c) => c.passed).length}/{checks.length}
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
                    approvedReady
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-warning/30 bg-warning/10 text-warning"
                  }`}
                >
                  {approvedReady ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  ) : (
                    <Lock className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    {approvedReady ? (
                      <>
                        <div className="font-semibold">Публикация визуально разрешена</div>
                        <div className="text-muted-foreground">
                          {pack.approved_by} ·{" "}
                          {new Date(pack.approved_at ?? "").toLocaleString("ru")}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold">Публикация заблокирована</div>
                        <div className="text-muted-foreground">
                          нужно: status approved + approved_by + approved_at
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock3 className="size-3" />
                  <span>{new Date(pack.created_at).toLocaleString("ru")}</span>
                </div>
              </div>

              {pack.draft_text && (
                <div className="tg-card space-y-3">
                  <SectionTitle>Draft content</SectionTitle>
                  <div className="rounded-lg border border-border bg-black/20 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {pack.draft_text}
                  </div>
                  <PackField label="hooks" values={pack.hooks} />
                  <PackField label="captions" values={pack.captions} />
                  <PackField label="visual_brief" value={pack.visual_brief} />
                  <PackField label="image_prompt" value={pack.image_prompt} />
                  <PackField label="video_script" value={pack.video_script} pre />
                  <PackField label="cta" value={pack.cta} />
                  <PackField label="checklist" values={pack.checklist} />
                </div>
              )}

              <SectionTitle>Ассеты пакета</SectionTitle>
              <div className="space-y-2">
                {assets.map((a) => {
                  const open = openId === a.id;
                  const text = a.text ?? a.image_prompt ?? a.video_prompt ?? "";
                  return (
                    <div key={a.id} className="tg-card-inset">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            onClick={() => setOpenId(open ? null : a.id)}
                            className="flex items-center gap-1.5 text-left text-sm font-semibold"
                          >
                            {open ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                            {PLATFORM_LABEL[a.platform] ?? a.platform}
                          </button>
                          <div className="text-[11px] text-muted-foreground">
                            {a.format} · v{a.version} · QC {a.qc_score ?? "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge status={a.status} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssetDrawerId(a.id);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Подробнее"
                          >
                            <Info className="size-4" />
                          </button>
                        </div>
                      </div>
                      {open && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={text}
                            onChange={(e) => s.updateAssetText(a.id, e.target.value)}
                            className="w-full bg-black/40 border border-border rounded-lg p-2.5 text-xs leading-relaxed min-h-[100px] outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => {
                              s.requestRewriteAsset(a.id);
                              toast(`Создана версия v${a.version + 1}`);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-warning/20 text-warning border border-warning/40 px-3 py-2 text-xs font-semibold"
                          >
                            <RefreshCw className="size-3.5" /> Переписать (новая версия)
                          </button>
                          {a.source_refs.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {a.source_refs.map((r) => (
                                <span key={r} className="chip">
                                  src: {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => {
                    s.requestRewrite(pack.id);
                    toast("Запрошен rewrite пакета");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-warning/20 text-warning border border-warning/40 px-3 py-2.5 text-sm font-semibold"
                >
                  <RefreshCw className="size-4" /> Переписать
                </button>
                <button
                  onClick={() => {
                    s.submitPackForReview(pack.id);
                    toast.success("Пакет отправлен на проверку");
                    navigate({ to: "/review" });
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold"
                >
                  <Send className="size-4" /> На проверку <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          );
        })
      )}

      <DetailDrawer
        open={!!packDrawer}
        onClose={() => setPackDrawerId(null)}
        kind="Контент-пакет"
        id={packDrawer?.id ?? ""}
        title={packDrawer?.title ?? ""}
        status={packDrawer?.status ?? ""}
        refs={
          packDrawer
            ? [
                { label: "idea_id", value: packDrawer.idea_id },
                { label: "source_id", value: packDrawer.source_id ?? "—" },
                { label: "analysis_id", value: packDrawer.analysis_id ?? "—" },
                { label: "platform", value: packDrawer.platform ?? "—" },
                { label: "format", value: packDrawer.format ?? "—" },
                { label: "hooks", value: packDrawer.hooks?.join(" · ") ?? "—" },
                { label: "captions", value: packDrawer.captions?.join(" · ") ?? "—" },
                { label: "checklist", value: packDrawer.checklist?.join(" · ") ?? "—" },
                { label: "approved_by", value: packDrawer.approved_by ?? "—" },
                {
                  label: "approved_at",
                  value: packDrawer.approved_at
                    ? new Date(packDrawer.approved_at).toLocaleString("ru")
                    : "—",
                },
                {
                  label: "assets",
                  value: String(s.assets.filter((a) => a.pack_id === packDrawer.id).length),
                },
                {
                  label: "checks",
                  value: String(s.reviewChecks.filter((c) => c.pack_id === packDrawer.id).length),
                },
              ]
            : []
        }
        nextActions={
          packDrawer
            ? [
                {
                  label: "На проверку",
                  onClick: () => {
                    s.submitPackForReview(packDrawer.id);
                    toast.success("На проверку");
                    navigate({ to: "/review" });
                  },
                  variant: "primary",
                },
                {
                  label: "Rewrite",
                  onClick: () => {
                    s.requestRewrite(packDrawer.id);
                    toast("Запрошен rewrite");
                  },
                  variant: "warn",
                },
                {
                  label: "К публикации",
                  onClick: () => navigate({ to: "/publish" }),
                  variant: "muted",
                  disabled: !s.canPublish(packDrawer.id),
                },
              ]
            : []
        }
      />

      <DetailDrawer
        open={!!assetDrawer}
        onClose={() => setAssetDrawerId(null)}
        kind="Asset"
        id={assetDrawer?.id ?? ""}
        title={assetDrawer ? (PLATFORM_LABEL[assetDrawer.platform] ?? assetDrawer.platform) : ""}
        status={assetDrawer?.status ?? ""}
        body={assetDrawer?.text ?? assetDrawer?.image_prompt ?? assetDrawer?.video_prompt ?? "—"}
        refs={
          assetDrawer
            ? [
                { label: "pack_id", value: assetDrawer.pack_id },
                { label: "platform", value: assetDrawer.platform },
                { label: "format", value: assetDrawer.format },
                { label: "qc_score", value: String(assetDrawer.qc_score ?? "—") },
                { label: "source_refs", value: assetDrawer.source_refs.join(", ") || "—" },
              ]
            : []
        }
        versions={
          assetDrawer
            ? Array.from({ length: assetDrawer.version }, (_, i) => ({
                label: `v${i + 1}`,
                current: i + 1 === assetDrawer.version,
              }))
            : []
        }
        nextActions={
          assetDrawer
            ? [
                {
                  label: "Переписать (новая версия)",
                  onClick: () => {
                    s.requestRewriteAsset(assetDrawer.id);
                    toast(`Создана v${assetDrawer.version + 1}`);
                  },
                  variant: "warn",
                },
              ]
            : []
        }
      />
    </>
  );
}

function PackField({
  label,
  value,
  values,
  pre = false,
}: {
  label: string;
  value?: string;
  values?: string[];
  pre?: boolean;
}) {
  const text = values?.length ? values.join(" · ") : value;
  if (!text) return null;

  return (
    <div className="text-xs">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-foreground/90 ${pre ? "whitespace-pre-wrap" : ""}`}>{text}</div>
    </div>
  );
}

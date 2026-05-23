import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ArrowRight, ChevronDown, ChevronRight, Info, RefreshCw, Send } from "lucide-react";

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
          return (
            <div key={pack.id} className="space-y-2">
              <div className="tg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      идея: {idea?.topic.slice(0, 36) ?? "—"}
                    </div>
                    <div className="font-semibold text-sm">{pack.title}</div>
                  </div>
                  <StatusBadge status={pack.status} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  {assets.length} ассетов · max v{Math.max(1, ...assets.map((a) => a.version))}
                </div>
              </div>

              <SectionTitle>Ассеты пакета</SectionTitle>
              <div className="space-y-2">
                {assets.map((a) => {
                  const open = openId === a.id;
                  const text = a.text ?? a.image_prompt ?? a.video_prompt ?? "";
                  return (
                    <div key={a.id} className="tg-card-inset">
                      <button
                        onClick={() => setOpenId(open ? null : a.id)}
                        className="w-full flex items-start justify-between gap-2 text-left"
                      >
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            {PLATFORM_LABEL[a.platform] ?? a.platform}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {a.format} · v{a.version} · QC {a.qc_score ?? "—"}
                          </div>
                        </div>
                        <StatusBadge status={a.status} />
                      </button>
                      {open && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={text}
                            onChange={(e) => s.updateAssetText(a.id, e.target.value)}
                            className="w-full bg-black/40 border border-border rounded-lg p-2.5 text-xs leading-relaxed min-h-[100px] outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => { s.requestRewriteAsset(a.id); toast(`Создана версия v${a.version + 1}`); }}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-warning/20 text-warning border border-warning/40 px-3 py-2 text-xs font-semibold"
                          >
                            <RefreshCw className="size-3.5" /> Переписать (новая версия)
                          </button>
                          {a.source_refs.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {a.source_refs.map((r) => (
                                <span key={r} className="chip">src: {r}</span>
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
                  onClick={() => { s.requestRewrite(pack.id); toast("Запрошен rewrite пакета"); }}
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
    </>
  );
}

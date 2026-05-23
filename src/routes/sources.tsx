import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { DetailDrawer } from "@/components/DetailDrawer";
import type { SourceType } from "@/types/pipeline";
import { ArrowRight, Plus, Play, X, Send, Info } from "lucide-react";

export const Route = createFileRoute("/sources")({ component: SourcesPage });

const TYPE_LABEL: Record<SourceType, string> = {
  competitor: "конкурент",
  trend: "тренд",
  brand_doc: "бренд-док",
  note: "заметка",
  video: "видео",
  screenshot: "скрин",
  metric: "метрика",
  research: "research",
};

function SourcesPage() {
  const s = usePipeline();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<SourceType>("competitor");
  const [tags, setTags] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(s.sources[0]?.id ?? null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const selected = s.sources.find((x) => x.id === selectedId) ?? null;
  const drawerSrc = s.sources.find((x) => x.id === drawerId) ?? null;

  function add() {
    if (!title.trim()) {
      toast.error("Укажите название источника");
      return;
    }
    s.addSource({
      title: title.trim(),
      url: url.trim() || undefined,
      source_type: type,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    toast.success("Источник сохранён");
    setTitle(""); setUrl(""); setTags("");
    setModalOpen(false);
  }

  return (
    <>
      <StageHeader
        step="Этап 1 · Вход + парсинг"
        title="Источники: рефы, тренды, документы и первичная обработка"
        description="Реф и парсинг — один бизнес-этап. На выходе: raw_text, summary, хуки, CTA, формат, риск, теги."
        badge={<span className="badge badge-new">inbox</span>}
      />

      <button
        onClick={() => setModalOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
      >
        <Plus className="size-4" /> Добавить источник
      </button>

      <SectionTitle>Инструменты этапа</SectionTitle>
      <ToolsRow tools={["ScrapeCreators", "ViralMaxing / Virale", "NotebookLM", "Notion / Sheets", "Postgres"]} />

      <SectionTitle>Очередь источников</SectionTitle>
      {s.sources.length === 0 ? (
        <EmptyState>Пока пусто. Нажмите «Добавить источник».</EmptyState>
      ) : (
        <div className="space-y-2">
          {s.sources.map((src) => {
            const active = src.id === selectedId;
            return (
              <button
                key={src.id}
                onClick={() => setSelectedId(src.id)}
                className={`w-full text-left tg-card ${active ? "ring-1 ring-primary/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      {TYPE_LABEL[src.source_type]}
                    </div>
                    <div className="font-semibold text-sm leading-snug truncate">{src.title}</div>
                  </div>
                  <StatusBadge status={src.status} />
                </div>
                {src.summary ? (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{src.summary}</p>
                ) : null}
                {src.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {src.tags.map((t) => (<span key={t} className="chip">#{t}</span>))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <>
          <SectionTitle>Действия над «{selected.title.slice(0, 28)}…»</SectionTitle>
          <div className="tg-card space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { s.parseSource(selected.id); toast.success("Парсинг выполнен"); }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-info/30 text-info border border-info/40 px-3 py-2.5 text-sm font-semibold"
              >
                <Play className="size-4" /> {selected.status === "parsed" ? "Reparse" : "Распарсить"}
              </button>
              <button
                onClick={() => { s.sendSourceToAnalysis(selected.id); toast.success("Передан в анализ"); }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold"
              >
                <Send className="size-4" /> В анализ
              </button>
              <button
                onClick={() => { s.rejectSource(selected.id); toast("Источник отклонён"); }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive/20 text-destructive border border-destructive/40 px-3 py-2.5 text-sm font-semibold col-span-2"
              >
                <X className="size-4" /> Отклонить
              </button>
            </div>
          </div>

          <SectionTitle>Поля источника (для БД)</SectionTitle>
          <div className="tg-card-inset text-xs space-y-1.5">
            <Field k="source_url" v={selected.url ?? "—"} />
            <Field k="raw_text" v={selected.raw_text ?? "не извлечён"} />
            <Field k="summary" v={selected.summary ?? "—"} />
            <Field k="hooks" v={selected.hooks?.join(" · ") || "—"} />
            <Field k="cta" v={selected.cta ?? "—"} />
            <Field k="format" v={selected.format ?? "—"} />
            <Field k="source_risk" v={selected.source_risk ?? "—"} />
            <Field k="tags" v={selected.tags.join(", ") || "—"} />
          </div>
        </>
      )}

      <Link
        to="/analysis"
        className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary/15 border border-primary/40 px-4 py-3 font-semibold text-primary"
      >
        Перейти к анализу <ArrowRight className="size-4" />
      </Link>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card border border-border rounded-2xl p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">Новый источник</div>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Название источника"
              className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <select
              value={type} onChange={(e) => setType(e.target.value as SourceType)}
              className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="теги через запятую"
              className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={add}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> Сохранить источник
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[88px]">{k}</span>
      <span className="text-foreground/90 break-words">{v}</span>
    </div>
  );
}

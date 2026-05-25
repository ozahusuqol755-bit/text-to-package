import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle, EmptyState } from "@/components/stage/StageHeader";
import { StatusBadge } from "@/components/stage/StatusBadge";
import { DetailDrawer } from "@/components/DetailDrawer";
import type { Source, SourceType } from "@/types/pipeline";
import { ArrowRight, Plus, Play, X, Send, Info, Upload, LoaderCircle } from "lucide-react";

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
  url: "url",
  text: "текст",
  manual: "manual",
  viralmaxing: "ViralMaxing",
};

function SourcesPage() {
  const s = usePipeline();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<SourceType>("competitor");
  const [tags, setTags] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(s.sources[0]?.id ?? null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const selected = s.sources.find((x) => x.id === selectedId) ?? null;
  const drawerSrc = s.sources.find((x) => x.id === drawerId) ?? null;
  const importedRefs = s.sources.filter((src) => src.source_type === "viralmaxing");
  const importing = s.apiAction === "import_google_sheet_refs" || s.apiAction === "import_csv_refs";

  function add() {
    if (!title.trim()) {
      toast.error("Укажите название источника");
      return;
    }
    s.addSource({
      title: title.trim(),
      url: url.trim() || undefined,
      source_type: type,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    toast.success("Источник сохранён");
    setTitle("");
    setUrl("");
    setTags("");
    setModalOpen(false);
  }

  async function importGoogleSheet() {
    if (!sheetUrl.trim()) {
      toast.error("Укажите Google Sheets CSV URL");
      return;
    }

    await s.importGoogleSheetRefs(sheetUrl.trim());
    if (s.apiMode !== "unavailable") {
      toast.success("Refs импортированы");
      setSheetUrl("");
    }
  }

  async function importCsv() {
    if (!csvText.trim()) {
      toast.error("Вставьте CSV из ViralMaxing");
      return;
    }

    await s.importCsvRefs(csvText);
    if (s.apiMode !== "unavailable") {
      toast.success("CSV refs импортированы");
      setCsvText("");
    }
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
      <ToolsRow
        tools={[
          "ScrapeCreators",
          "ViralMaxing / Virale",
          "NotebookLM",
          "Notion / Sheets",
          "Postgres",
        ]}
      />

      <SectionTitle>Импорт ViralMaxing refs</SectionTitle>
      <div className="tg-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Google Sheets → Sources / Refs</div>
            <div className="text-xs text-muted-foreground">
              Строки таблицы сохраняются как отдельные refs перед Analysis.
            </div>
          </div>
          <span className="badge badge-info">source_type=viralmaxing</span>
        </div>

        <div className="flex gap-2">
          <input
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Google Sheets URL или public CSV export URL"
            className="min-w-0 flex-1 bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => void importGoogleSheet()}
            disabled={importing}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {importing ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Import
          </button>
        </div>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="CSV fallback: url,platform,views,likes,comments,shares,saves,engagement_rate,author,caption,published_at,detected_at,niche"
          rows={3}
          className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => void importCsv()}
          disabled={importing}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary/15 border border-primary/40 px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"
        >
          {importing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Import CSV fallback
        </button>
      </div>

      <SectionTitle>Импортированные refs</SectionTitle>
      {importedRefs.length === 0 ? (
        <EmptyState>ViralMaxing refs ещё не импортированы.</EmptyState>
      ) : (
        <div className="tg-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-left font-medium">url</th>
                <th className="py-2 pr-3 text-left font-medium">platform</th>
                <th className="py-2 pr-3 text-right font-medium">views</th>
                <th className="py-2 pr-3 text-right font-medium">likes</th>
                <th className="py-2 pr-3 text-right font-medium">comments</th>
                <th className="py-2 pr-3 text-right font-medium">shares</th>
                <th className="py-2 pr-3 text-right font-medium">engagement_rate</th>
                <th className="py-2 pr-3 text-left font-medium">status</th>
                <th className="py-2 text-right font-medium">action</th>
              </tr>
            </thead>
            <tbody>
              {importedRefs.map((src) => (
                <tr key={src.id} className="border-b border-border/70 last:border-b-0">
                  <td className="max-w-[220px] py-2 pr-3">
                    <span className="block truncate">{src.url ?? "—"}</span>
                  </td>
                  <td className="py-2 pr-3">{metric(src, "platform")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{metric(src, "views")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{metric(src, "likes")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{metric(src, "comments")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{metric(src, "shares")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {metric(src, "engagement_rate")}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={src.status} />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => void s.analyzeSourceViaBackend(src.id)}
                      disabled={s.apiAction === "analyze_selected_source"}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/15 border border-primary/40 px-2.5 py-1.5 font-semibold text-primary disabled:opacity-60"
                    >
                      <Send className="size-3.5" />В Analysis
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle>Очередь источников</SectionTitle>
      {s.sources.length === 0 ? (
        <EmptyState>Пока пусто. Нажмите «Добавить источник».</EmptyState>
      ) : (
        <div className="space-y-2">
          {s.sources.map((src) => {
            const active = src.id === selectedId;
            return (
              <div
                key={src.id}
                onClick={() => setSelectedId(src.id)}
                className={`tg-card cursor-pointer ${active ? "ring-1 ring-primary/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      {TYPE_LABEL[src.source_type]}
                    </div>
                    <div className="font-semibold text-sm leading-snug truncate">{src.title}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={src.status} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerId(src.id);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Подробнее"
                    >
                      <Info className="size-4" />
                    </button>
                  </div>
                </div>
                {src.summary ? (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{src.summary}</p>
                ) : null}
                {src.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {src.tags.map((t) => (
                      <span key={t} className="chip">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
                onClick={() => {
                  s.parseSource(selected.id);
                  toast.success("Парсинг выполнен");
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-info/30 text-info border border-info/40 px-3 py-2.5 text-sm font-semibold"
              >
                <Play className="size-4" />{" "}
                {selected.status === "parsed" ? "Reparse" : "Распарсить"}
              </button>
              <button
                onClick={() => {
                  s.sendSourceToAnalysis(selected.id);
                  toast.success("Передан в анализ");
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold"
              >
                <Send className="size-4" /> В анализ
              </button>
              <button
                onClick={() => {
                  s.rejectSource(selected.id);
                  toast("Источник отклонён");
                }}
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название источника"
              className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
              className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
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

      <DetailDrawer
        open={!!drawerSrc}
        onClose={() => setDrawerId(null)}
        kind="Источник"
        id={drawerSrc?.id ?? ""}
        title={drawerSrc?.title ?? ""}
        status={drawerSrc?.status ?? ""}
        body={drawerSrc?.summary || drawerSrc?.raw_text || "—"}
        refs={
          drawerSrc
            ? [
                { label: "source_type", value: TYPE_LABEL[drawerSrc.source_type] },
                { label: "url", value: drawerSrc.url ?? "—" },
                { label: "hooks", value: drawerSrc.hooks?.join(" · ") || "—" },
                { label: "cta", value: drawerSrc.cta ?? "—" },
                { label: "tags", value: drawerSrc.tags.join(", ") || "—" },
                { label: "source_risk", value: drawerSrc.source_risk ?? "—" },
              ]
            : []
        }
        nextActions={
          drawerSrc
            ? [
                {
                  label: drawerSrc.status === "parsed" ? "Reparse" : "Распарсить",
                  onClick: () => s.parseSource(drawerSrc.id),
                  variant: "muted",
                },
                {
                  label: "В анализ",
                  onClick: () => s.sendSourceToAnalysis(drawerSrc.id),
                  variant: "primary",
                },
                {
                  label: "Отклонить",
                  onClick: () => s.rejectSource(drawerSrc.id),
                  variant: "danger",
                },
              ]
            : []
        }
      />
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

function metric(source: Source, key: string): string {
  const value = source.raw_payload?.[key];
  if (typeof value === "number") {
    return Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return "—";
}

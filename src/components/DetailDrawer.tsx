import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { usePipeline } from "@/store/PipelineStore";
import { StatusBadge } from "@/components/stage/StatusBadge";
import type { LogEvent } from "@/types/pipeline";

interface NextAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "warn" | "muted";
}

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Short type label like "Источник", "Идея", … */
  kind: string;
  id: string;
  title: string;
  status: string;
  /** Pre-formatted reference rows: { label: 'idea_id', value: 'idea_1' } */
  refs?: { label: string; value: ReactNode }[];
  /** Optional version timeline */
  versions?: { label: string; ts?: string; current?: boolean }[];
  /** Available next actions for this entity */
  nextActions?: NextAction[];
  /** Free-form extra content (e.g. body text, prompt) */
  body?: ReactNode;
}

const variantClass = {
  primary: "bg-primary text-primary-foreground",
  danger: "bg-destructive/20 text-destructive border border-destructive/40",
  warn: "bg-warning/20 text-warning border border-warning/40",
  muted: "bg-muted text-muted-foreground border border-border",
} as const;

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("ru", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DetailDrawer({
  open,
  onClose,
  kind,
  id,
  title,
  status,
  refs,
  versions,
  nextActions,
  body,
}: DetailDrawerProps) {
  const s = usePipeline();
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) setComment("");
  }, [open, id]);

  if (!open) return null;

  const entityLogs: LogEvent[] = s.logs.filter((l) => l.entity_id === id || l.job_id === id);
  const comments = entityLogs.filter((l) => l.action === "comment");
  const history = entityLogs.filter((l) => l.action !== "comment");

  function addComment() {
    if (!comment.trim()) return;
    s.log({
      stage: "comments",
      action: "comment",
      entity_id: id,
      message: comment.trim(),
      level: "info",
    });
    setComment("");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border-t border-border rounded-t-2xl max-h-[88vh] overflow-y-auto"
      >
        {/* header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-start justify-between gap-2 z-10">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {kind} · {id}
            </div>
            <div className="font-semibold text-sm leading-snug truncate">{title}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={status} />
            <button onClick={onClose} className="text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {body ? <div className="tg-card-inset text-xs leading-relaxed">{body}</div> : null}

          {refs && refs.length > 0 && (
            <Section title="Связанные сущности (refs)">
              <div className="tg-card-inset text-xs space-y-1.5">
                {refs.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-muted-foreground min-w-[96px]">{r.label}</span>
                    <span className="text-foreground/90 break-words">{r.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {versions && versions.length > 0 && (
            <Section title="Версии">
              <div className="tg-card-inset text-xs space-y-1.5">
                {versions.map((v, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span
                      className={
                        v.current ? "text-foreground font-semibold" : "text-muted-foreground"
                      }
                    >
                      {v.label}
                      {v.current ? " · текущая" : ""}
                    </span>
                    {v.ts ? (
                      <span className="text-[10px] text-muted-foreground">{formatTs(v.ts)}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {nextActions && nextActions.length > 0 && (
            <Section title="Следующие действия">
              <div className="grid grid-cols-2 gap-2">
                {nextActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={a.onClick}
                    disabled={a.disabled}
                    className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed ${variantClass[a.variant ?? "primary"]}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title={`История действий (${history.length})`}>
            {history.length === 0 ? (
              <div className="tg-card-inset text-xs text-muted-foreground text-center py-4">
                Событий по этой сущности пока нет.
              </div>
            ) : (
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="tg-card-inset text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-foreground/90">{h.action ?? "—"}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTs(h.ts)}</span>
                    </div>
                    {(h.status_before || h.status_after) && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {h.status_before ?? "—"} →{" "}
                        <span className="text-foreground/80">{h.status_after ?? "—"}</span>
                      </div>
                    )}
                    <div className="text-foreground/80 mt-1">{h.message}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {h.actor ?? "system"} · {h.result ?? h.level}
                      {h.job_id ? ` · job ${h.job_id}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Комментарии (${comments.length})`}>
            <div className="space-y-1.5">
              {comments.map((c) => (
                <div key={c.id} className="tg-card-inset text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{c.actor ?? "system"}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTs(c.ts)}</span>
                  </div>
                  <div className="text-foreground/85 mt-1 whitespace-pre-wrap">{c.message}</div>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  placeholder="Добавить комментарий…"
                  className="flex-1 bg-black/30 border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-primary"
                />
                <button
                  onClick={addComment}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  +
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-info mb-1.5 px-1">{title}</div>
      {children}
    </div>
  );
}

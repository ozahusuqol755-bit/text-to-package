import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function StageHeader({
  step,
  title,
  description,
  badge,
}: {
  step: string;
  title: string;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="tg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{step}</div>
          <div className="font-semibold leading-snug mt-0.5">{title}</div>
        </div>
        {badge}
      </div>
      {description ? (
        <p className="text-sm text-muted-foreground/90 mt-2 leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}

export function ToolsRow({ tools }: { tools: string[] }) {
  return (
    <div className="tg-card flex flex-wrap gap-1.5">
      {tools.map((t) => (
        <span key={t} className="chip chip-tool">
          {t}
        </span>
      ))}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.08em] text-info mt-5 mb-2 px-1">
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
      <div className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </div>
      <div className="max-w-sm text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

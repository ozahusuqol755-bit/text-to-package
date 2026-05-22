import type { ReactNode } from "react";

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
        <p className="text-sm text-muted-foreground/90 mt-2 leading-relaxed">
          {description}
        </p>
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
    <div className="tg-card text-center text-sm text-muted-foreground py-8">
      {children}
    </div>
  );
}

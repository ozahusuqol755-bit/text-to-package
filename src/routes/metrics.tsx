import { createFileRoute, Link } from "@tanstack/react-router";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, ToolsRow, SectionTitle } from "@/components/stage/StageHeader";
import { ArrowRight, Repeat } from "lucide-react";

export const Route = createFileRoute("/metrics")({ component: MetricsPage });

function MetricsPage() {
  const s = usePipeline();
  const totals = s.metrics.reduce(
    (acc, m) => ({
      views: acc.views + m.views,
      er: acc.er + m.er,
      saves: acc.saves + m.saves,
    }),
    { views: 0, er: 0, saves: 0 },
  );
  const avgEr = (totals.er / Math.max(1, s.metrics.length)).toFixed(1);

  return (
    <>
      <StageHeader
        step="Этап 7 · Обратная связь"
        title="Метрики возвращаются в новый цикл"
        description="Просмотры, лайки, комменты, сохранения, CTR, ER, ошибки и выводы. Это становится новым сигналом для анализа и следующих идей."
        badge={<span className="badge badge-success">feedback</span>}
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat value={formatK(totals.views)} label="просмотры" />
        <Stat value={`${avgEr}%`} label="средний ER" />
        <Stat value={totals.saves} label="сейвы" />
      </div>

      <ToolsRow tools={["DOHOO", "n8n", "Postgres", "weekly report"]} />

      <SectionTitle>Сигналы по площадкам</SectionTitle>
      <div className="space-y-2">
        {s.metrics.map((m) => (
          <div key={m.id} className="tg-card">
            <div className="flex items-start justify-between">
              <div className="font-semibold text-sm uppercase">{m.platform}</div>
              <div className="text-[11px] text-muted-foreground">
                {m.views} views · ER {m.er}%
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2 text-[11px]">
              <Mini k="likes" v={m.likes} />
              <Mini k="comm." v={m.comments} />
              <Mini k="shares" v={m.shares} />
              <Mini k="saves" v={m.saves} />
            </div>
            {m.errors && <div className="text-xs text-warning mt-2">⚠ {m.errors}</div>}
            {m.conclusion && (
              <div className="text-xs text-info mt-2">Вывод: {m.conclusion}</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 rounded-xl border border-dashed border-primary/40 bg-primary/10 p-3">
        <div className="font-semibold text-sm flex items-center gap-2">
          <Repeat className="size-4 text-primary" /> Новый цикл
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Метрики становятся новым рефом и отправляются обратно в анализ.
        </p>
        <Link
          to="/analysis"
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
        >
          Отправить метрики в анализ <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="tg-card-inset text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
function Mini({ k, v }: { k: string; v: number }) {
  return (
    <div className="bg-black/30 rounded-md px-2 py-1.5">
      <div className="text-muted-foreground">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}
function formatK(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

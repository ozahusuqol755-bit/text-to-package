import { createFileRoute } from "@tanstack/react-router";
import { usePipeline } from "@/store/PipelineStore";
import { StageHeader, SectionTitle } from "@/components/stage/StageHeader";

export const Route = createFileRoute("/tools")({ component: ToolsPage });

const STAGE_LABEL: Record<string, string> = {
  all: "все этапы",
  sources: "источники",
  analysis: "анализ",
  ideas: "идеи",
  packs: "пакеты",
  review: "проверка",
  publish: "публикация",
};

function ToolsPage() {
  const s = usePipeline();
  return (
    <>
      <StageHeader
        step="System map"
        title="Инструменты конвейера"
        description="Карта тулзов из XMind. Каждый инструмент привязан к этапу пайплайна."
      />
      <SectionTitle>Инструменты</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {s.tools.map((t) => (
          <div key={t.id} className="tg-card-inset">
            <div className="font-semibold text-sm">{t.name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{t.role}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.stage.map((st) => (
                <span key={st} className="chip">
                  {STAGE_LABEL[st] ?? st}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

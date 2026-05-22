import type { Analysis } from "@/types/pipeline";

const now = new Date().toISOString();

export const mockAnalyses: Analysis[] = [
  {
    id: "an_1",
    source_id: "src_1",
    source_refs: ["src_1"],
    meaning: "Автоматизация без контроля опасна для бренда",
    hook: "Почему AI-контенту нужен ручной approve",
    angle: "Approve gate как страховка",
    pain: "Бренд теряет лицо из-за автопостинга",
    promise: "Контент-завод + ручной approve = скорость без рисков",
    cta: "Посмотреть, как устроен пульт",
    risk_notes: "Не копировать структуру конкурента",
    risk_status: "active",
    platform_fit: ["telegram", "threads", "x"],
    priority_score: 9,
    decision: "to_idea",
    created_at: now,
  },
  {
    id: "an_2",
    source_id: "src_2",
    source_refs: ["src_2"],
    meaning: "n8n — исполнитель, Postgres — источник правды",
    hook: "Не делайте n8n мозгом системы",
    angle: "Архитектурный разбор",
    pain: "Логика размазана по сценариям n8n",
    promise: "Единая БД статусов и approve",
    cta: "Скачать схему",
    risk_notes: "—",
    risk_status: "active",
    platform_fit: ["telegram", "vk"],
    priority_score: 8,
    decision: "to_idea",
    created_at: now,
  },
];

import type { Source } from "@/types/pipeline";

const now = new Date().toISOString();

export const mockSources: Source[] = [
  {
    id: "src_1",
    title: "ViralMaxing — обзор офера конкурента",
    url: "https://viralmaxing.com/ru",
    source_type: "competitor",
    status: "parsed",
    raw_text: "Конкурент строит контент-фабрику с упором на автопостинг…",
    summary: "Конкурент строит контент-фабрику с упором на автопостинг.",
    hooks: ["Автоматизация без контроля", "Конвейер контента за 7 дней"],
    cta: "Подписаться на канал",
    format: "longread",
    source_risk: "medium",
    tags: ["viralmaxing", "конкурент", "офер"],
    created_at: now,
  },
  {
    id: "src_2",
    title: "NotebookLM — выжимка research по AI-контенту",
    source_type: "research",
    status: "ready_for_analysis",
    summary: "Тезисы: approve gate, ручной контроль, риск копипасты.",
    hooks: ["Approve gate как защита бренда"],
    tags: ["research", "notebooklm"],
    created_at: now,
  },
  {
    id: "src_3",
    title: "Telegram тренд-канал @ai_daily",
    url: "https://t.me/ai_daily",
    source_type: "trend",
    status: "new",
    tags: ["telegram", "тренды"],
    created_at: now,
  },
  {
    id: "src_4",
    title: "Бренд-док клиента (тон, запреты)",
    source_type: "brand_doc",
    status: "ready_for_analysis",
    summary: "Тон спокойный, без хайпа. Запреты: политика, медицина.",
    tags: ["бренд", "правила"],
    created_at: now,
  },
];

import type { Tool } from "@/types/pipeline";

export const mockTools: Tool[] = [
  { id: "t1", name: "Claude Code Channel", role: "Telegram-пульт / вход оператора", stage: ["all"] },
  { id: "t2", name: "Claude Code", role: "Оркестратор и генератор", stage: ["analysis", "ideas", "packs"] },
  { id: "t3", name: "Codex", role: "Контролёр, ревьюер, разработчик", stage: ["review"] },
  { id: "t4", name: "n8n", role: "Автоматизация процессов", stage: ["publish", "sources"] },
  { id: "t5", name: "Postgres", role: "Источник правды", stage: ["all"] },
  { id: "t6", name: "Notion / Google Sheets", role: "Витрина и review-таблицы", stage: ["review", "ideas"] },
  { id: "t7", name: "ScrapeCreators", role: "Сбор публичных данных", stage: ["sources"] },
  { id: "t8", name: "ViralMaxing / Virale", role: "Тренды, идеи, рефы конкурентов", stage: ["sources", "analysis"] },
  { id: "t9", name: "NotebookLM", role: "Глубокий research и summary", stage: ["sources", "analysis"] },
  { id: "t10", name: "DOHOO", role: "Публикация и расписание", stage: ["publish"] },
  { id: "t11", name: "Vizard", role: "Нарезка длинных видео", stage: ["packs"] },
  { id: "t12", name: "CapCut", role: "Доводка видео", stage: ["packs"] },
];

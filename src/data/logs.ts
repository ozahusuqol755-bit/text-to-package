import type { LogEvent } from "@/types/pipeline";

const now = new Date().toISOString();

export const mockLogs: LogEvent[] = [
  { id: "log_1", ts: now, stage: "sources", actor: "@operator_kz", action: "parse", message: "Источник ViralMaxing распарсен", level: "success" },
  { id: "log_2", ts: now, stage: "analysis", actor: "@operator_kz", action: "decide", message: "Сформировано 2 паттерна", level: "info" },
  { id: "log_3", ts: now, stage: "ideas", actor: "@operator_kz", action: "accept", message: "Идея #1 принята оператором", level: "success" },
  { id: "log_4", ts: now, stage: "packs", actor: "@operator_kz", action: "build", message: "Контент-пакет pack_1 собран (9 ассетов)", level: "info" },
];

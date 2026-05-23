import type { Idea } from "@/types/pipeline";

const now = new Date().toISOString();

export const mockIdeas: Idea[] = [
  {
    id: "idea_1",
    topic: "Почему AI-контенту нужен ручной approve",
    angle: "Approve gate как защита бренда",
    source_refs: ["src_1", "src_2", "src_4"],
    platform_targets: [
      "telegram",
      "threads",
      "x",
      "vk",
      "instagram",
      "reels",
      "tiktok",
      "image",
      "video",
    ],
    priority: "high",
    priority_score: 9,
    tags: ["approve", "безопасность", "telegram"],
    status: "accepted",
    created_at: now,
  },
  {
    id: "idea_2",
    topic: "n8n — исполнитель, Postgres — источник правды",
    angle: "Архитектурный разбор",
    source_refs: ["src_2"],
    platform_targets: ["telegram", "vk"],
    priority: "medium",
    priority_score: 7,
    tags: ["n8n", "архитектура"],
    status: "draft",
    created_at: now,
  },
];

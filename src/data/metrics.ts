import type { Metric, PublishJob } from "@/types/pipeline";

export const mockPublishJobs: PublishJob[] = [];

export const mockMetrics: Metric[] = [
  {
    id: "m_1",
    pack_id: "pack_0_demo",
    platform: "telegram",
    views: 4823,
    likes: 312,
    comments: 41,
    shares: 28,
    saves: 23,
    ctr: 6.2,
    er: 7.4,
    conclusion: "Тема approve-gate зашла, делать продолжение",
  },
  {
    id: "m_2",
    pack_id: "pack_0_demo",
    platform: "threads",
    views: 1820,
    likes: 96,
    comments: 54,
    shares: 12,
    saves: 8,
    ctr: 3.1,
    er: 9.2,
    conclusion: "Много ответов — делать короткие серии",
  },
  {
    id: "m_3",
    pack_id: "pack_0_demo",
    platform: "tiktok",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    ctr: 0,
    er: 0,
    errors: "Нет видео-модуля",
    conclusion: "Подключить Vizard / CapCut",
  },
];

import type {
  AssetStatus,
  IdeaStatus,
  PackStatus,
  PublishStatus,
  SourceStatus,
} from "@/types/pipeline";

const map: Record<string, { cls: string; label: string }> = {
  // sources
  new: { cls: "badge-new", label: "Новый" },
  parsed: { cls: "badge-parsed", label: "Распарсен" },
  ready_for_analysis: { cls: "badge-info", label: "В анализ" },
  // analyses / ideas
  draft: { cls: "badge-draft", label: "Черновик" },
  accepted: { cls: "badge-success", label: "Принята" },
  in_pack: { cls: "badge-info", label: "В пакете" },
  // packs
  ready_for_review: { cls: "badge-warn", label: "На проверке" },
  rewrite_requested: { cls: "badge-warn", label: "На доработку" },
  approved: { cls: "badge-success", label: "Согласован" },
  rejected: { cls: "badge-error", label: "Отклонён" },
  // publish
  scheduled: { cls: "badge-info", label: "В расписании" },
  publishing: { cls: "badge-info", label: "Публикуется" },
  published: { cls: "badge-success", label: "Опубликовано" },
  failed: { cls: "badge-error", label: "Ошибка публикации" },
  // pseudo
  blocked: { cls: "badge-error", label: "Заблокировано" },
  ready_to_publish: { cls: "badge-success", label: "Готово к публикации" },
};

export function StatusBadge({
  status,
}: {
  status: SourceStatus | IdeaStatus | PackStatus | AssetStatus | PublishStatus | string;
}) {
  const m = map[status] ?? { cls: "badge-draft", label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

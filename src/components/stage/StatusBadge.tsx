import type {
  AssetStatus,
  IdeaStatus,
  PackStatus,
  PublishStatus,
  SourceStatus,
} from "@/types/pipeline";

const map: Record<string, { cls: string; label: string }> = {
  new: { cls: "badge-new", label: "новый" },
  parsed: { cls: "badge-parsed", label: "распарсен" },
  failed: { cls: "badge-error", label: "ошибка" },
  rejected: { cls: "badge-error", label: "отклонён" },
  ready_for_analysis: { cls: "badge-info", label: "в анализ" },
  draft: { cls: "badge-draft", label: "черновик" },
  accepted: { cls: "badge-success", label: "принята" },
  in_pack: { cls: "badge-info", label: "в пакете" },
  rewrite_requested: { cls: "badge-warn", label: "на доработку" },
  ready_for_review: { cls: "badge-warn", label: "на проверку" },
  approved: { cls: "badge-success", label: "согласовано" },
  scheduled: { cls: "badge-info", label: "в расписании" },
  publishing: { cls: "badge-info", label: "публикуется" },
  published: { cls: "badge-success", label: "опубликовано" },
};

export function StatusBadge({
  status,
}: {
  status: SourceStatus | IdeaStatus | PackStatus | AssetStatus | PublishStatus | string;
}) {
  const m = map[status] ?? { cls: "badge-draft", label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

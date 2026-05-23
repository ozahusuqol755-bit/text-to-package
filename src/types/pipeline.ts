export type SourceType =
  | "competitor"
  | "trend"
  | "brand_doc"
  | "note"
  | "video"
  | "screenshot"
  | "metric"
  | "research";

export type SourceStatus =
  | "new"
  | "parsed"
  | "failed"
  | "rejected"
  | "ready_for_analysis";

export interface Source {
  id: string;
  title: string;
  url?: string;
  source_type: SourceType;
  status: SourceStatus;
  raw_text?: string;
  summary?: string;
  hooks?: string[];
  cta?: string;
  format?: string;
  source_risk?: "low" | "medium" | "high";
  tags: string[];
  created_at: string;
}

export type AnalysisDecision = "to_idea" | "archive" | "stop";
export type AnalysisRiskStatus = "active" | "stopped" | "archived";

export interface Analysis {
  id: string;
  source_id: string;
  source_refs: string[];
  meaning: string;
  hook: string;
  angle: string;
  pain: string;
  promise: string;
  cta: string;
  risk_notes: string;
  risk_status: AnalysisRiskStatus;
  platform_fit: Platform[];
  priority_score: number;
  decision: AnalysisDecision;
  created_at: string;
}

export type Platform =
  | "telegram"
  | "threads"
  | "x"
  | "vk"
  | "instagram"
  | "reels"
  | "tiktok"
  | "image"
  | "video";

export type IdeaStatus = "draft" | "accepted" | "rejected" | "in_pack";

export interface Idea {
  id: string;
  topic: string;
  angle: string;
  source_refs: string[];
  platform_targets: Platform[];
  priority: "low" | "medium" | "high";
  priority_score: number;
  tags: string[];
  status: IdeaStatus;
  created_at: string;
}

export type AssetFormat =
  | "post"
  | "caption"
  | "script"
  | "image_prompt"
  | "video_brief";

export type AssetStatus =
  | "draft"
  | "rewrite_requested"
  | "ready_for_review"
  | "approved"
  | "rejected";

export interface ContentAsset {
  id: string;
  pack_id: string;
  platform: Platform;
  format: AssetFormat;
  text?: string;
  image_prompt?: string;
  video_prompt?: string;
  source_refs: string[];
  status: AssetStatus;
  version: number;
  qc_score?: number;
}

export type PackStatus =
  | "draft"
  | "rewrite_requested"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "publishing"
  | "published";

export interface ContentPack {
  id: string;
  idea_id: string;
  title: string;
  status: PackStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface ReviewCheck {
  id: string;
  pack_id: string;
  label: string;
  required: boolean;
  passed: boolean;
  note?: string;
}

export type PublishStatus =
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface PublishJob {
  id: string;
  pack_id: string;
  asset_id: string;
  platform: Platform;
  tool: "n8n" | "DOHOO" | "Telegram Bot" | "platform_api";
  status: PublishStatus;
  scheduled_at?: string;
  published_at?: string;
  error?: string;
  attempts: number;
}

export interface Metric {
  id: string;
  pack_id: string;
  platform: Platform;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  ctr: number;
  er: number;
  errors?: string;
  conclusion?: string;
  signaled?: boolean;
}

export interface Tool {
  id: string;
  name: string;
  role: string;
  stage: string[];
}

export type LogResult = "success" | "warning" | "error";
export type LogEntityType =
  | "source"
  | "analysis"
  | "idea"
  | "pack"
  | "asset"
  | "check"
  | "publish_job"
  | "metric";

export interface LogEvent {
  id: string;
  ts: string;
  stage: string;
  entity_type?: LogEntityType;
  entity_id?: string;
  actor?: string;
  action?: string;
  status_before?: string;
  status_after?: string;
  result?: LogResult;
  job_id?: string;
  message: string;
  /** @deprecated kept for back-compat; mirrors `result` */
  level: "info" | "warn" | "error" | "success";
}

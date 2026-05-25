-- Add JSON payload columns for enriched ViralMaxing analysis and idea output.
-- Existing MVP columns stay intact for backwards-compatible UI/cards.

alter table analyses
  add column if not exists analysis_payload jsonb not null default '{}'::jsonb;

alter table ideas
  add column if not exists idea_payload jsonb not null default '{}'::jsonb;

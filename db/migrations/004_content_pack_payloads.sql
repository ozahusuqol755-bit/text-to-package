-- Add enriched content pack payload fields for the MVP idea -> content_pack step.
-- Existing review/publish fields remain intact.

alter table content_packs
  add column if not exists source_id uuid references sources(id) on delete set null,
  add column if not exists analysis_id uuid references analyses(id) on delete set null,
  add column if not exists platform text,
  add column if not exists format text,
  add column if not exists draft_text text,
  add column if not exists hooks jsonb not null default '[]'::jsonb,
  add column if not exists captions jsonb not null default '[]'::jsonb,
  add column if not exists visual_brief text,
  add column if not exists image_prompt text,
  add column if not exists video_script text,
  add column if not exists cta text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists content_pack_payload jsonb not null default '{}'::jsonb;

alter table content_packs drop constraint if exists content_packs_status_check;
alter table content_packs add constraint content_packs_status_check check (
  status in (
    'draft',
    'drafted',
    'rewrite_requested',
    'ready_for_review',
    'needs_review',
    'approved',
    'rejected',
    'scheduled',
    'publishing',
    'published',
    'failed'
  )
);

create index if not exists idx_content_packs_source_id on content_packs(source_id);
create index if not exists idx_content_packs_analysis_id on content_packs(analysis_id);

-- Initial schema draft for AI Content Factory MVP.
-- Postgres is the source of truth. Cross-row business guards such as publish
-- eligibility are enforced in API transactions, not with database triggers.

create extension if not exists pgcrypto;

create table sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  source_type text not null check (
    source_type in (
      'competitor',
      'trend',
      'brand_doc',
      'note',
      'video',
      'screenshot',
      'metric',
      'research',
      'viralmaxing',
      'url',
      'text',
      'manual'
    )
  ),
  status text not null default 'new' check (
    status in ('new', 'imported', 'uploaded', 'parsed', 'failed', 'rejected', 'ready_for_analysis')
  ),
  raw_text text,
  raw_payload jsonb not null default '{}'::jsonb,
  summary text,
  hooks jsonb not null default '[]'::jsonb,
  cta text,
  format text,
  source_risk text check (source_risk in ('low', 'medium', 'high')),
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table analyses (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  metric_id uuid,
  source_refs jsonb not null default '[]'::jsonb,
  meaning text not null,
  hook text not null,
  angle text not null,
  pain text not null,
  promise text not null,
  cta text not null,
  risk_notes text not null,
  risk_status text not null default 'active' check (
    risk_status in ('active', 'stopped', 'archived')
  ),
  platform_fit jsonb not null default '[]'::jsonb,
  priority_score integer not null check (priority_score >= 0),
  decision text not null default 'to_idea' check (decision in ('to_idea', 'archive', 'stop')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (((source_id is not null)::int + (metric_id is not null)::int) = 1)
);

alter table sources drop constraint if exists sources_source_type_check;
alter table sources add constraint sources_source_type_check check (
  source_type in (
    'competitor',
    'trend',
    'brand_doc',
    'note',
    'video',
    'screenshot',
    'metric',
    'research',
    'viralmaxing',
    'url',
    'text',
    'manual'
  )
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  angle text not null,
  source_refs jsonb not null default '[]'::jsonb,
  platform_targets jsonb not null default '[]'::jsonb,
  priority text not null check (priority in ('low', 'medium', 'high')),
  priority_score integer not null check (priority_score >= 0),
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (
    status in ('draft', 'accepted', 'rejected', 'in_pack')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table content_packs (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete restrict,
  title text not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'rewrite_requested',
      'ready_for_review',
      'approved',
      'rejected',
      'scheduled',
      'publishing',
      'published'
    )
  ),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table content_assets (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references content_packs(id) on delete cascade,
  platform text not null check (
    platform in ('telegram', 'threads', 'x', 'vk', 'instagram', 'reels', 'tiktok', 'image', 'video')
  ),
  format text not null check (
    format in ('post', 'caption', 'script', 'image_prompt', 'video_brief')
  ),
  text text,
  image_prompt text,
  video_prompt text,
  source_refs jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (
    status in ('draft', 'rewrite_requested', 'ready_for_review', 'approved', 'rejected')
  ),
  version integer not null default 1 check (version >= 1),
  qc_score integer check (qc_score is null or (qc_score >= 0 and qc_score <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table review_checks (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references content_packs(id) on delete cascade,
  label text not null,
  required boolean not null default true,
  passed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Approve guard is intentionally enforced in the API transaction:
-- the pack must have at least one review_checks row, at least one required row,
-- and every required row except human_review_required must have passed = true.
-- The approve action itself marks human_review_required as passed.

create table publish_jobs (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references content_packs(id) on delete cascade,
  asset_id uuid not null references content_assets(id) on delete cascade,
  platform text not null check (
    platform in ('telegram', 'threads', 'x', 'vk', 'instagram', 'reels', 'tiktok', 'image', 'video')
  ),
  tool text not null check (tool in ('n8n', 'DOHOO', 'Telegram Bot', 'platform_api')),
  status text not null default 'publishing' check (
    status in ('approved', 'scheduled', 'publishing', 'published', 'failed')
  ),
  scheduled_at timestamptz,
  published_at timestamptz,
  error text,
  attempts integer not null default 1 check (attempts >= 0),
  external_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Publish guard is intentionally not a trigger:
-- enforced in API transaction with:
--   content_packs.status = 'approved'
--   approved_by is not null
--   approved_at is not null
-- The API transaction also writes pipeline_logs and creates publish_jobs.

create table metrics (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references content_packs(id) on delete cascade,
  platform text not null check (
    platform in ('telegram', 'threads', 'x', 'vk', 'instagram', 'reels', 'tiktok', 'image', 'video')
  ),
  views integer not null default 0 check (views >= 0),
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  shares integer not null default 0 check (shares >= 0),
  saves integer not null default 0 check (saves >= 0),
  ctr numeric(8, 2) not null default 0 check (ctr >= 0),
  er numeric(8, 2) not null default 0 check (er >= 0),
  errors text,
  conclusion text,
  signaled boolean not null default false,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table analyses
  add constraint analyses_metric_id_fkey
  foreign key (metric_id) references metrics(id) on delete cascade;

create table pipeline_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  stage text not null,
  entity_type text check (
    entity_type in ('source', 'analysis', 'idea', 'content_pack', 'pack', 'asset', 'check', 'publish_job', 'metric')
  ),
  entity_id uuid,
  actor text,
  action text,
  status_before text,
  status_after text,
  result text check (result in ('success', 'warning', 'error')),
  job_id uuid references publish_jobs(id) on delete set null,
  message text not null,
  level text not null check (level in ('info', 'warn', 'error', 'success')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  stage jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_sources_updated_at
before update on sources
for each row execute function set_updated_at();

create trigger trg_analyses_updated_at
before update on analyses
for each row execute function set_updated_at();

create trigger trg_ideas_updated_at
before update on ideas
for each row execute function set_updated_at();

create trigger trg_content_packs_updated_at
before update on content_packs
for each row execute function set_updated_at();

create trigger trg_content_assets_updated_at
before update on content_assets
for each row execute function set_updated_at();

create trigger trg_review_checks_updated_at
before update on review_checks
for each row execute function set_updated_at();

create trigger trg_publish_jobs_updated_at
before update on publish_jobs
for each row execute function set_updated_at();

create trigger trg_metrics_updated_at
before update on metrics
for each row execute function set_updated_at();

create trigger trg_pipeline_logs_updated_at
before update on pipeline_logs
for each row execute function set_updated_at();

create trigger trg_tools_updated_at
before update on tools
for each row execute function set_updated_at();

create index idx_sources_status on sources(status);
create index idx_sources_source_type on sources(source_type);

create index idx_analyses_status on analyses(risk_status);
create index idx_analyses_decision on analyses(decision);
create index idx_analyses_source_id on analyses(source_id);
create index idx_analyses_metric_id on analyses(metric_id);

create index idx_ideas_status on ideas(status);

create index idx_content_packs_status on content_packs(status);
create index idx_content_packs_idea_id on content_packs(idea_id);

create index idx_content_assets_status on content_assets(status);
create index idx_content_assets_pack_id on content_assets(pack_id);

create index idx_review_checks_pack_id on review_checks(pack_id);
create index idx_review_checks_pack_required on review_checks(pack_id, required);

create index idx_publish_jobs_status on publish_jobs(status);
create index idx_publish_jobs_pack_id on publish_jobs(pack_id);
create index idx_publish_jobs_asset_id on publish_jobs(asset_id);

create index idx_metrics_pack_id on metrics(pack_id);

create index idx_pipeline_logs_entity_id on pipeline_logs(entity_id);
create index idx_pipeline_logs_entity on pipeline_logs(entity_type, entity_id);
create index idx_pipeline_logs_job_id on pipeline_logs(job_id);
create index idx_pipeline_logs_ts on pipeline_logs(ts desc);

create index idx_tools_enabled on tools(enabled);

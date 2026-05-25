-- Track AI adapter usage without storing secrets. Empty-env deterministic fallback
-- is also recorded here so tomorrow's provider switch can be verified safely.

create table if not exists ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (
    task_type in (
      'bulk_analysis',
      'analysis',
      'idea',
      'content_pack',
      'image_prompt',
      'image_generation',
      'video_prompt',
      'video_generation'
    )
  ),
  provider text not null,
  model_used text,
  key_alias text not null check (
    key_alias in ('default', 'fast', 'smart', 'write', 'image', 'video')
  ),
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric,
  status text not null check (status in ('success', 'error', 'fallback')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_logs_task_type on ai_usage_logs(task_type);
create index if not exists idx_ai_usage_logs_key_alias on ai_usage_logs(key_alias);
create index if not exists idx_ai_usage_logs_status on ai_usage_logs(status);
create index if not exists idx_ai_usage_logs_created_at on ai_usage_logs(created_at desc);

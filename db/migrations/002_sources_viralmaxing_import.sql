-- Add ViralMaxing refs import support for existing local/demo databases.
-- Each imported Google Sheets/CSV row is stored as one source/ref first;
-- downstream analysis is still triggered explicitly by the operator.

alter table sources
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

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

alter table sources drop constraint if exists sources_status_check;
alter table sources add constraint sources_status_check check (
  status in ('new', 'imported', 'uploaded', 'parsed', 'failed', 'rejected', 'ready_for_analysis')
);

create index if not exists idx_sources_source_type on sources(source_type);

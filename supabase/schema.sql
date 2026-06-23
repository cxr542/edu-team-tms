-- Supabase schema draft for EDU-TMS sync
-- This file is a planning baseline only.
-- Application write/read logic is not connected to these tables yet.

create extension if not exists "pgcrypto";

create table if not exists public.journal_snapshots (
  id uuid primary key default gen_random_uuid(),
  member_code text not null,
  payload jsonb not null,
  payload_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint journal_snapshots_member_code_not_blank
    check (length(trim(member_code)) > 0)
);

create unique index if not exists journal_snapshots_member_code_uidx
  on public.journal_snapshots (member_code);

create index if not exists journal_snapshots_updated_at_idx
  on public.journal_snapshots (updated_at desc);


create table if not exists public.kpi_operational_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'team',
  payload jsonb not null,
  payload_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint kpi_operational_snapshots_scope_not_blank
    check (length(trim(scope)) > 0)
);

create unique index if not exists kpi_operational_snapshots_scope_uidx
  on public.kpi_operational_snapshots (scope);

create index if not exists kpi_operational_snapshots_updated_at_idx
  on public.kpi_operational_snapshots (updated_at desc);


create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  member_code text,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now(),

  constraint sync_events_source_not_blank
    check (length(trim(source)) > 0),

  constraint sync_events_event_type_not_blank
    check (length(trim(event_type)) > 0)
);

create index if not exists sync_events_created_at_idx
  on public.sync_events (created_at desc);

create index if not exists sync_events_member_code_created_at_idx
  on public.sync_events (member_code, created_at desc);


-- Row Level Security is intentionally enabled early.
-- Policies should be tightened before connecting production writes.

alter table public.journal_snapshots enable row level security;
alter table public.kpi_operational_snapshots enable row level security;
alter table public.sync_events enable row level security;

-- Temporary development policies.
-- Do not use these policies as-is for production write access.
-- Production policies should be added in a later PR after auth strategy is decided.

create policy "journal_snapshots_read_all_draft"
  on public.journal_snapshots
  for select
  using (true);

create policy "kpi_operational_snapshots_read_all_draft"
  on public.kpi_operational_snapshots
  for select
  using (true);

create policy "sync_events_read_all_draft"
  on public.sync_events
  for select
  using (true);

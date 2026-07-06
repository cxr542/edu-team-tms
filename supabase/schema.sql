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


create table if not exists public.kpi_monthly_approvals (
  id uuid primary key default gen_random_uuid(),
  member_code text not null,
  year_month text not null,
  status text not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  approver text,
  reject_reason text,
  monthly01 jsonb not null,
  payload_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint kpi_monthly_approvals_member_code_not_blank
    check (length(trim(member_code)) > 0),

  constraint kpi_monthly_approvals_year_month_format
    check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

create unique index if not exists kpi_monthly_approvals_member_code_year_month_uidx
  on public.kpi_monthly_approvals (member_code, year_month);

create index if not exists kpi_monthly_approvals_updated_at_idx
  on public.kpi_monthly_approvals (updated_at desc);


create table if not exists public.kpi2_row_approvals (
  id uuid primary key default gen_random_uuid(),
  member_code text not null,
  day_key text not null,
  task_id text not null,
  status text not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  approver text,
  reject_reason text,
  kpi2_row_status jsonb not null,
  payload_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint kpi2_row_approvals_member_code_not_blank
    check (length(trim(member_code)) > 0),

  constraint kpi2_row_approvals_day_key_format
    check (day_key ~ '^\d{4}-\d{2}-\d{2}$'),

  constraint kpi2_row_approvals_task_id_not_blank
    check (length(trim(task_id)) > 0)
);

create unique index if not exists kpi2_row_approvals_member_code_day_key_task_id_uidx
  on public.kpi2_row_approvals (member_code, day_key, task_id);

create index if not exists kpi2_row_approvals_updated_at_idx
  on public.kpi2_row_approvals (updated_at desc);


create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'notice',
  is_pinned boolean not null default false,
  is_published boolean not null default false,
  author text not null,
  author_code text not null,
  published_at timestamptz,
  payload_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint announcements_title_not_blank
    check (length(trim(title)) > 0),

  constraint announcements_body_not_blank
    check (length(trim(body)) > 0),

  constraint announcements_category_not_blank
    check (category in ('notice', 'release', 'incident', 'guide')),

  constraint announcements_author_not_blank
    check (length(trim(author)) > 0),

  constraint announcements_author_code_not_blank
    check (length(trim(author_code)) > 0)
);

create unique index if not exists announcements_id_uidx
  on public.announcements (id);

create index if not exists announcements_pinned_updated_at_idx
  on public.announcements (is_pinned desc, updated_at desc);

create index if not exists announcements_published_updated_at_idx
  on public.announcements (is_published, updated_at desc);


create table if not exists public.csr_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'improvement',
  status text not null default 'received',
  requester text not null,
  requester_code text not null,
  admin_comment text not null default '',
  completed_at timestamptz,
  payload_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint csr_requests_title_not_blank
    check (length(trim(title)) > 0),

  constraint csr_requests_category_not_blank
    check (length(trim(category)) > 0),

  constraint csr_requests_status_not_blank
    check (length(trim(status)) > 0),

  constraint csr_requests_requester_not_blank
    check (length(trim(requester)) > 0),

  constraint csr_requests_requester_code_not_blank
    check (length(trim(requester_code)) > 0)
);

create unique index if not exists csr_requests_id_uidx
  on public.csr_requests (id);

create index if not exists csr_requests_status_updated_at_idx
  on public.csr_requests (status, updated_at desc);

create index if not exists csr_requests_requester_code_updated_at_idx
  on public.csr_requests (requester_code, updated_at desc);


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
alter table public.kpi_monthly_approvals enable row level security;
alter table public.kpi2_row_approvals enable row level security;
alter table public.announcements enable row level security;
alter table public.csr_requests enable row level security;
alter table public.sync_events enable row level security;

grant select, insert, update on table public.kpi_monthly_approvals to anon;
grant select, insert, update on table public.kpi2_row_approvals to anon;
grant select, insert, update on table public.announcements to anon;
grant select, insert, update on table public.csr_requests to anon;

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

create policy "kpi_monthly_approvals_read_all_draft"
  on public.kpi_monthly_approvals
  for select
  using (true);

create policy "kpi_monthly_approvals_insert_all_draft"
  on public.kpi_monthly_approvals
  for insert
  with check (true);

create policy "kpi_monthly_approvals_update_all_draft"
  on public.kpi_monthly_approvals
  for update
  using (true)
  with check (true);

create policy "kpi2_row_approvals_read_all_draft"
  on public.kpi2_row_approvals
  for select
  using (true);

create policy "kpi2_row_approvals_insert_all_draft"
  on public.kpi2_row_approvals
  for insert
  with check (true);

create policy "kpi2_row_approvals_update_all_draft"
  on public.kpi2_row_approvals
  for update
  using (true)
  with check (true);

create policy "announcements_read_all_draft"
  on public.announcements
  for select
  using (true);

create policy "announcements_insert_all_draft"
  on public.announcements
  for insert
  with check (true);

create policy "announcements_update_all_draft"
  on public.announcements
  for update
  using (true)
  with check (true);

create policy "csr_requests_read_all_draft"
  on public.csr_requests
  for select
  using (true);

create policy "csr_requests_insert_all_draft"
  on public.csr_requests
  for insert
  with check (true);

create policy "csr_requests_update_all_draft"
  on public.csr_requests
  for update
  using (true)
  with check (true);

create policy "sync_events_read_all_draft"
  on public.sync_events
  for select
  using (true);

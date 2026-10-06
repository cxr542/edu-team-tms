-- Ledger (team-building expenses) migration — DRAFT, NOT APPLIED.
-- Adds 3 NEW tables only; no existing table, policy or grant is touched.
--
-- Access model (differs on purpose from csr_requests' open anon-write model):
--   * anon / authenticated : SELECT only (team viewers read directly via REST)
--   * service_role         : full access (serverless API verifies admin session, then writes)
--   * RLS on, and NO insert/update/delete policy for anon or authenticated.
-- Supabase grants ALL on new public tables to anon/authenticated by default,
-- so the explicit REVOKE below is required, not optional.

-- ── categories ───────────────────────────────────────────────────────────
create table if not exists public.ledger_categories (
  id             text primary key,            -- e.g. 'teatime' (kept from snapshot)
  label          text not null,               -- e.g. '티타임'
  color          text,
  description    text,
  match_keywords text[] not null default '{}',
  sort_order     integer not null default 0,
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ledger_categories_id_not_blank check (length(trim(id)) > 0),
  constraint ledger_categories_label_not_blank check (length(trim(label)) > 0)
);

-- ── transactions ─────────────────────────────────────────────────────────
-- id is the existing snapshot id ('tx-excel-1', 'tx-kakao-1791248114573', ...)
-- so the migration is an idempotent upsert on the original key.
create table if not exists public.ledger_transactions (
  id             text primary key,
  tx_date        date not null,               -- calendar date as written (KST), no time zone
  category       text not null,               -- snapshot stores the LABEL ('티타임'), kept as-is
  description    text not null default '',
  amount         integer not null,            -- KRW, whole won
  balance        integer not null,            -- running balance as stored in the snapshot
  payment_method text,
  attendees      text,
  extra_data     jsonb not null default '{}'::jsonb,  -- 영수증번호, 비고, 원문 ...
  sort_order     integer not null default 0,  -- position in the snapshot (balance is order-dependent)
  version        integer not null default 1,  -- optimistic-lock counter
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ledger_transactions_id_not_blank check (length(trim(id)) > 0),
  constraint ledger_transactions_extra_is_object check (jsonb_typeof(extra_data) = 'object')
);

create index if not exists ledger_transactions_date_idx
  on public.ledger_transactions (tx_date, sort_order);

-- ── settings (viewerMenuVisibility lives here) ───────────────────────────
create table if not exists public.ledger_settings (
  key        text primary key,
  value      jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint ledger_settings_key_known check (key in ('viewer_menu_visibility'))
);

-- ── version / updated_at bump on every UPDATE ────────────────────────────
-- The API updates with `where id = $1 and version = $expected`; 0 rows => conflict (409).
create or replace function public.ledger_bump_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ledger_categories_bump on public.ledger_categories;
create trigger ledger_categories_bump before update on public.ledger_categories
  for each row execute function public.ledger_bump_version();

drop trigger if exists ledger_transactions_bump on public.ledger_transactions;
create trigger ledger_transactions_bump before update on public.ledger_transactions
  for each row execute function public.ledger_bump_version();

drop trigger if exists ledger_settings_bump on public.ledger_settings;
create trigger ledger_settings_bump before update on public.ledger_settings
  for each row execute function public.ledger_bump_version();

-- ── RLS + grants ─────────────────────────────────────────────────────────
alter table public.ledger_categories   enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_settings     enable row level security;

revoke all on table public.ledger_categories   from anon, authenticated;
revoke all on table public.ledger_transactions from anon, authenticated;
revoke all on table public.ledger_settings     from anon, authenticated;

grant select on table public.ledger_categories   to anon, authenticated;
grant select on table public.ledger_transactions to anon, authenticated;
grant select on table public.ledger_settings     to anon, authenticated;

grant all on table public.ledger_categories   to service_role;
grant all on table public.ledger_transactions to service_role;
grant all on table public.ledger_settings     to service_role;

drop policy if exists "ledger_categories_read" on public.ledger_categories;
create policy "ledger_categories_read" on public.ledger_categories
  for select to anon, authenticated using (true);

drop policy if exists "ledger_transactions_read" on public.ledger_transactions;
create policy "ledger_transactions_read" on public.ledger_transactions
  for select to anon, authenticated using (true);

drop policy if exists "ledger_settings_read" on public.ledger_settings;
create policy "ledger_settings_read" on public.ledger_settings
  for select to anon, authenticated using (true);

-- ── ROLLBACK (only if nothing else depends on these tables yet) ──────────
-- drop table if exists public.ledger_transactions, public.ledger_categories, public.ledger_settings;
-- drop function if exists public.ledger_bump_version();

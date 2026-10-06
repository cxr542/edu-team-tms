-- Ledger write support — DRAFT, NOT APPLIED. Needs approval before running in production.
--   1. ledger_bump_version(): do NOT bump version/updated_at when only `balance` changed.
--      balance is derived (monthly budget - running total); the server recomputes it for every row
--      of an edited month, and that must not invalidate other rows' optimistic-lock versions.
--   2. admin_login_attempts: failed-login log for brute-force throttling (service role only).
-- Existing tables/policies are untouched. Both parts are safe to re-run.

-- ── 1. version bump ignores balance-only changes ─────────────────────────
create or replace function public.ledger_bump_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'ledger_transactions'
     and (to_jsonb(new) - 'balance' - 'version' - 'updated_at')
       = (to_jsonb(old) - 'balance' - 'version' - 'updated_at') then
    new.version := old.version;
    new.updated_at := old.updated_at;
    return new;
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

-- ── 2. login attempt log ─────────────────────────────────────────────────
create table if not exists public.admin_login_attempts (
  id           bigint generated always as identity primary key,
  ip_hash      text not null,                       -- salted sha256 prefix, never the raw IP
  success      boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_lookup_idx
  on public.admin_login_attempts (ip_hash, attempted_at desc);

alter table public.admin_login_attempts enable row level security;
revoke all on table public.admin_login_attempts from anon, authenticated;
grant all on table public.admin_login_attempts to service_role;
-- no policies: only service_role (bypasses RLS) can read or write.

-- ── ROLLBACK ─────────────────────────────────────────────────────────────
-- drop table if exists public.admin_login_attempts;
-- restore the previous trigger function by re-running the function in supabase/ledger.sql

-- Anon hardening, phase 1 — DRAFT, NOT APPLIED. Needs approval before running in production.
--
-- Scope: changes that cannot affect any feature the app uses today.
--   A. kanban_tasks: drop the open anon/authenticated policy and revoke their table privileges.
--      The browser never touches this table; /api/kanban-tasks writes with the service role,
--      which bypasses RLS and keeps its own grants.
--   B. Six tables: revoke TRUNCATE / TRIGGER / REFERENCES from anon and authenticated.
--      No app code uses these privileges (PostgREST cannot issue TRUNCATE; the app never
--      creates triggers or foreign keys at runtime). anon currently holds them by default.
--
-- NOT touched here (phase 2/3): the INSERT / UPDATE / DELETE policies the browser still relies on
--   glossary_terms, csr_requests, csr_request_attachments, kpi_monthly_approvals, kpi2_row_approvals.
-- Safe to re-run: REVOKE of a privilege that is not held is a no-op, DROP POLICY uses IF EXISTS.

-- ── A. kanban_tasks ──────────────────────────────────────────────────────
drop policy if exists "kanban_tasks_all_policy" on public.kanban_tasks;
revoke all on table public.kanban_tasks from anon, authenticated;
-- RLS stays enabled with no policy: anon/authenticated are denied; service_role bypasses RLS.
alter table public.kanban_tasks enable row level security;

-- ── B. drop privileges nothing uses ──────────────────────────────────────
revoke truncate, trigger, references on table public.glossary_terms             from anon, authenticated;
revoke truncate, trigger, references on table public.csr_requests               from anon, authenticated;
revoke truncate, trigger, references on table public.csr_request_attachments    from anon, authenticated;
revoke truncate, trigger, references on table public.kpi_monthly_approvals      from anon, authenticated;
revoke truncate, trigger, references on table public.kpi2_row_approvals         from anon, authenticated;

-- ── VERIFY (read-only; run after applying) ───────────────────────────────
-- 1) anon / authenticated privileges per table — kanban_tasks must be empty; the other five must
--    show only SELECT / INSERT / UPDATE / DELETE (no TRUNCATE, TRIGGER, REFERENCES):
-- select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
-- from information_schema.role_table_grants
-- where table_schema = 'public' and grantee in ('anon','authenticated')
--   and table_name in ('kanban_tasks','glossary_terms','csr_requests','csr_request_attachments',
--                      'kpi_monthly_approvals','kpi2_row_approvals')
-- group by 1, 2 order by 1, 2;
-- 2) kanban_tasks must have RLS on and zero policies:
-- select c.relrowsecurity, (select count(*) from pg_policies p where p.schemaname='public' and p.tablename='kanban_tasks')
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname='kanban_tasks';
-- 3) Then open the Kanban page (needs admin login) and add / edit / delete a card.

-- ── ROLLBACK (restores exactly what existed before; verified against the live grants on 2026-10-06) ──
-- create policy "kanban_tasks_all_policy" on public.kanban_tasks
--   for all to anon, authenticated, service_role using (true) with check (true);
-- grant select, insert, update, delete, references, trigger, truncate on table public.kanban_tasks to anon;
-- grant references, trigger, truncate on table public.kanban_tasks to authenticated;
-- grant truncate, trigger, references on table public.glossary_terms          to anon, authenticated;
-- grant truncate, trigger, references on table public.csr_requests            to anon, authenticated;
-- grant truncate, trigger, references on table public.csr_request_attachments to anon, authenticated;
-- grant truncate, trigger, references on table public.kpi_monthly_approvals   to anon, authenticated;
-- grant truncate, trigger, references on table public.kpi2_row_approvals      to anon, authenticated;

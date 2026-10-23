-- Anon hardening, phase 2b (glossary_terms) — DRAFT, NOT APPLIED. Needs approval before running in production.
--
-- Apply ONLY AFTER the glossary admin API (/api/glossary-admin) is deployed AND verified:
-- an admin must be able to add, edit and delete a term from /admin. Until then the browser still
-- writes with the anon key and closing it here would break "새 용어 등록" / edit / delete.
--
-- Effect: the browser (anon) can only READ glossary terms. Writes happen in the server API with the
-- service role after the admin session is verified. Reads (term list, quiz) are unaffected.
-- Live policies before this change (checked 2026-10-06):
--   "Allow upsert for authenticated and anon users"  ALL    {public}  true / true   <- dropped here
--   "Allow read access to all users"                 SELECT {public}  true          <- kept
-- Safe to re-run.

drop policy if exists "Allow upsert for authenticated and anon users" on public.glossary_terms;

revoke insert, update, delete on table public.glossary_terms from anon, authenticated;

-- additive safety: the server API needs these (service_role bypasses RLS but still needs table privileges)
grant select, insert, update, delete on table public.glossary_terms to service_role;

-- ── VERIFY (read-only; run after applying) ───────────────────────────────
-- select policyname, cmd, roles from pg_policies where schemaname='public' and tablename='glossary_terms';
--   -> only "Allow read access to all users" (SELECT) must remain
-- select grantee, string_agg(privilege_type, ',' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema='public' and table_name='glossary_terms' and grantee in ('anon','authenticated','service_role')
--   group by 1;
--   -> anon: SELECT only · authenticated: (none) · service_role: DELETE,INSERT,SELECT,UPDATE (+ others)
-- Anon write probe that cannot change data (deletes a slug that does not exist):
--   curl -i -X DELETE "$SUPABASE_URL/rest/v1/glossary_terms?slug=eq.__probe_does_not_exist__" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   -> must answer 401/403 "permission denied" (it would answer 204 if anon could still delete)

-- ── ROLLBACK (restores exactly what existed before) ──────────────────────
-- create policy "Allow upsert for authenticated and anon users" on public.glossary_terms
--   for all to public using (true) with check (true);
-- grant insert, update, delete on table public.glossary_terms to anon;

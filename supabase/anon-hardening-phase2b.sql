-- Anon hardening, phase 2b (glossary_terms) — closes anon writes.
-- Applied to production on 2026-10-23 (after the glossary admin API was deployed and verified).
--
-- Effect: the browser (anon) can only READ glossary terms. Writes happen in /api/glossary-admin with
-- the service role after the admin session is verified. Reads (term list, quiz) are unaffected.
--
-- PREREQUISITE (already applied separately on 2026-10-23, kept here so a rebuild is not missed):
--   service_role must hold table privileges. It bypasses RLS but still needs GRANTs, and without
--   them the API fails with "permission denied for table glossary_terms".
--     grant select, insert, update, delete on table public.glossary_terms to service_role;
--
-- Live policies before this change:
--   "Allow upsert for authenticated and anon users"  ALL    {public}  true / true   <- dropped here
--   "Allow read access to all users"                 SELECT {public}  true          <- kept
-- Safe to re-run.

drop policy if exists "Allow upsert for authenticated and anon users" on public.glossary_terms;

revoke insert, update, delete on table public.glossary_terms from anon, authenticated;

-- ── VERIFY (read-only; run after applying) ───────────────────────────────
-- select policyname, cmd, roles from pg_policies where schemaname='public' and tablename='glossary_terms';
--   -> only "Allow read access to all users" (SELECT) must remain
-- select grantee, string_agg(privilege_type, ',' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema='public' and table_name='glossary_terms' and grantee in ('anon','authenticated','service_role')
--   group by 1;
--   -> anon: SELECT only · service_role: DELETE,INSERT,SELECT,UPDATE (+ others)
-- Anon write probes that cannot change data (target a slug that does not exist). Do NOT probe with INSERT:
-- every NOT NULL column has a default, so an INSERT would create a real row if it were still allowed.
--   curl -i -X DELETE "$SUPABASE_URL/rest/v1/glossary_terms?slug=eq.__probe_does_not_exist__" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   curl -i -X PATCH  "$SUPABASE_URL/rest/v1/glossary_terms?slug=eq.__probe_does_not_exist__" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"title":"x"}'
--   -> both must answer 401/403 "permission denied" (they would answer 204 if anon could still write)

-- ── ROLLBACK (restores exactly what existed before) ──────────────────────
-- create policy "Allow upsert for authenticated and anon users" on public.glossary_terms
--   for all to public using (true) with check (true);
-- grant insert, update, delete on table public.glossary_terms to anon;

-- J3: allow /api/journal-snapshots (service role) to read/write journal_snapshots.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Does not change RLS policies; service_role still bypasses RLS after GRANT.

grant select, insert, update on table public.journal_snapshots to service_role;
grant select, insert, update on table public.kpi_operational_snapshots to service_role;
grant select, insert, update on table public.announcements to service_role;

select
  grantee,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('journal_snapshots', 'kpi_operational_snapshots', 'announcements')
  and grantee = 'service_role'
group by grantee, table_name
order by table_name;

-- J7e: allow /api/journal-snapshots (service role) to insert sync_events audit rows.
-- Safe to re-run. Does not open anon write on sync_events.

grant insert on table public.sync_events to service_role;

select
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'sync_events'
  and grantee = 'service_role'
order by privilege_type;

# Supabase Phase 0 — `tms_profiles` provisioning

Run in **Supabase SQL Editor** after each user completes **magic-link signup** once.

## 1. Confirm Auth users exist

```sql
select id, email, created_at
from auth.users
order by created_at;
```

## 2. Insert profiles (replace UUIDs and emails)

```sql
-- Team lead / admin (member_code must be NULL)
insert into public.tms_profiles (id, email, member_code, role)
values (
  '00000000-0000-0000-0000-000000000001',  -- auth.users.id
  'leader@example.com',
  null,
  'admin'
)
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  member_code = excluded.member_code,
  updated_at = now();

-- Member A
insert into public.tms_profiles (id, email, member_code, role)
values (
  '00000000-0000-0000-0000-000000000002',
  'member-a@example.com',
  'A',
  'member'
)
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  member_code = excluded.member_code,
  updated_at = now();

-- Member B
insert into public.tms_profiles (id, email, member_code, role)
values (
  '00000000-0000-0000-0000-000000000003',
  'member-b@example.com',
  'B',
  'member'
)
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  member_code = excluded.member_code,
  updated_at = now();

-- Member C
insert into public.tms_profiles (id, email, member_code, role)
values (
  '00000000-0000-0000-0000-000000000004',
  'member-c@example.com',
  'C',
  'member'
)
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  member_code = excluded.member_code,
  updated_at = now();
```

## 3. Verify

```sql
select email, member_code, role from public.tms_profiles order by role desc, member_code;
```

## Notes

- `tms_profiles.id` must match `auth.users.id` (FK).
- Members require `role = 'member'` and `member_code` in (`A`,`B`,`C`).
- Admins require `role = 'admin'` and `member_code IS NULL`.
- Journal / KPI operational mirror writes use these profiles + Supabase Auth session.
- Announcements / CSR still use anon draft policies until a later auth hardening PR.

-- 오늘 뭐 먹지: 구성원별 점심 방문 기록 (하루 한 곳).
-- 읽기·쓰기 모두 서버 경로(/api/lunch-visits, service role)만 쓴다. anon·authenticated 에는 권한을 주지 않는다.
-- 다시 실행해도 안전하다(기존 행은 건드리지 않음).

create table if not exists public.lunch_visits (
  id uuid primary key default gen_random_uuid(),
  member_code text not null check (member_code in ('A', 'B', 'C')),
  visited_on date not null,
  spot_id text not null check (char_length(spot_id) between 1 and 200),
  spot_name text not null check (char_length(spot_name) between 1 and 120),
  category text not null default '' check (char_length(category) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_code, visited_on)
);

create index if not exists lunch_visits_member_day_idx
  on public.lunch_visits (member_code, visited_on desc);

-- RLS 를 켜고 정책은 두지 않는다 → anon·authenticated 는 행을 못 본다. service role 은 RLS 를 우회한다.
alter table public.lunch_visits enable row level security;

revoke all on table public.lunch_visits from anon, authenticated;
grant select, insert, update, delete on table public.lunch_visits to service_role;

-- 확인: anon·authenticated 행이 하나도 없어야 한다.
-- service_role 은 Supabase 기본 권한 때문에 7개(TRUNCATE·REFERENCES·TRIGGER 포함)가 보일 수 있고, 정상이다.
-- postgres(테이블 소유자) 행도 보일 수 있다.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'lunch_visits'
order by grantee, privilege_type;

-- 롤백(필요할 때만, 기록이 모두 지워짐):
-- drop table if exists public.lunch_visits;

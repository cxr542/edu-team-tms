-- 오늘 뭐 먹지: 팀이 함께 쓰는 식당 목록(구성원이 등록, 모두에게 보임).
-- 읽기·쓰기 모두 서버 경로(/api/lunch-spots, service role)만 쓴다. anon·authenticated 에는 권한을 주지 않는다.
-- 수정·삭제는 서버에서 "등록한 구성원 또는 관리자"만 허용한다.
-- 다시 실행해도 안전하다(기존 행은 건드리지 않음).

create table if not exists public.lunch_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  -- 종류·가격대·도보·메뉴·태그·지도 주소·메모 등 식당 정보(서버에서 검사한 값만 저장)
  data jsonb not null default '{}'::jsonb,
  created_by text not null check (created_by in ('A', 'B', 'C', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lunch_spots_created_idx on public.lunch_spots (created_at);

-- RLS 를 켜고 정책은 두지 않는다 → anon·authenticated 는 행을 못 본다. service role 은 RLS 를 우회한다.
alter table public.lunch_spots enable row level security;

revoke all on table public.lunch_spots from anon, authenticated;
grant select, insert, update, delete on table public.lunch_spots to service_role;

-- 확인: anon·authenticated 행이 하나도 없어야 한다.
-- service_role 은 Supabase 기본 권한 때문에 7개(TRUNCATE·REFERENCES·TRIGGER 포함)가 보일 수 있고, 정상이다.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'lunch_spots'
order by grantee, privilege_type;

-- 롤백(필요할 때만, 팀 식당이 모두 지워짐):
-- drop table if exists public.lunch_spots;

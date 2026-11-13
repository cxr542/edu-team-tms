-- 사이드바 메뉴 이름·순서의 팀 공유 설정.
-- 관리자가 「메뉴 이름·순서 변경」에서 바꾼 값을 한 행(key='nav-menu')에 JSON 으로 저장한다.
-- Supabase SQL Editor 에서 1회 실행. 재실행 안전. (아직 운영에 적용하지 않음 — 승인 후 실행)
-- 이 테이블이 없으면 화면은 지금처럼 브라우저별 저장으로 동작하고, 공유 저장 실패 안내만 보인다.
create table if not exists public.nav_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nav_settings enable row level security;

-- 읽기·쓰기 모두 /api/nav-settings 서버(service role, 관리자 세션 확인)만 한다.
-- anon/authenticated 에는 정책도 권한도 주지 않는다.
revoke all on table public.nav_settings from anon, authenticated;
grant select, insert, update on table public.nav_settings to service_role;

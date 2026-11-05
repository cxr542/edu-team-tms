-- 참고문서 '강의 가이드' 숨김 목록.
-- 파일은 삭제하지 않고, 관리자가 숨긴 doc id 만 기록한다. (복구 = 행 삭제)
-- Supabase SQL Editor 에서 1회 실행. 재실행 안전. (아직 운영에 적용하지 않음 — 승인 후 실행)
create table if not exists public.reference_doc_hidden (
  doc_id text primary key,
  hidden_at timestamptz not null default now()
);

alter table public.reference_doc_hidden enable row level security;

-- 읽기: 구성원 브라우저(anon)가 숨김 목록을 읽어 메뉴에서 제외한다.
drop policy if exists "Allow read reference doc hidden" on public.reference_doc_hidden;
create policy "Allow read reference doc hidden"
  on public.reference_doc_hidden for select
  using (true);

-- 쓰기: anon 에는 권한을 주지 않는다. /api 서버(service role)만 쓴다.
-- Supabase 기본 권한으로 anon/authenticated 에 붙는 불필요 권한(TRUNCATE 등)을 회수한다.
revoke all on table public.reference_doc_hidden from anon, authenticated;
grant select on table public.reference_doc_hidden to anon;
grant select, insert, update, delete on table public.reference_doc_hidden to service_role;

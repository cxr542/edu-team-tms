-- 참고문서 '강의 가이드' 구성원 제출(승인 대기).
-- 승인 전 본문은 공개되면 안 되므로 anon 에는 읽기·쓰기 권한을 주지 않는다. /api(service role)만 접근한다.
-- Supabase SQL Editor 에서 1회 실행. 재실행 안전. (운영 적용은 승인 후)
create table if not exists public.reference_doc_submissions (
  id text primary key,
  title text not null check (length(trim(title)) > 0),
  grp text not null check (length(trim(grp)) > 0),
  summary text not null default '',
  submitter text not null default '',
  html text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  created_at timestamptz not null default now()
);

alter table public.reference_doc_submissions enable row level security;

-- 정책을 만들지 않는다 = anon/authenticated 는 RLS 로도 막힌다 (service role 은 RLS 우회).
revoke all on table public.reference_doc_submissions from anon, authenticated;
grant select, insert, update, delete on table public.reference_doc_submissions to service_role;

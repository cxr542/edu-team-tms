-- 참고문서 '강의 가이드' 관리자 업로드본.
-- HTML 본문은 정화·마스킹이 끝난 상태로 저장된다. 쓰기는 /api(service role)만, 읽기는 anon.
-- Supabase SQL Editor 에서 1회 실행. 재실행 안전. (운영 적용은 승인 후)
create table if not exists public.reference_doc_uploads (
  id text primary key,
  title text not null check (length(trim(title)) > 0),
  grp text not null check (length(trim(grp)) > 0),
  summary text not null default '',
  html text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  created_at timestamptz not null default now()
);

alter table public.reference_doc_uploads enable row level security;

drop policy if exists "Allow read reference doc uploads" on public.reference_doc_uploads;
create policy "Allow read reference doc uploads"
  on public.reference_doc_uploads for select
  using (true);

revoke all on table public.reference_doc_uploads from anon, authenticated;
grant select on table public.reference_doc_uploads to anon;
grant select, insert, update, delete on table public.reference_doc_uploads to service_role;

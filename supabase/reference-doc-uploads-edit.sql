-- 참고문서 '강의 가이드' 업로드본 편집 지원: 수정 시각 + 이전 본문 1개 보관.
-- reference-doc-uploads.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에서 1회 실행. 재실행 안전.
-- 권한은 기존 그대로(anon 읽기, 쓰기는 /api service role).
alter table public.reference_doc_uploads
  add column if not exists updated_at timestamptz,
  add column if not exists prev_html text,
  add column if not exists prev_size_bytes integer;

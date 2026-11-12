-- 참고문서 업로드본·구성원 제출에 '문서 종류(category)'와 '태그(tags)' 추가.
--  category: 'lecture'(강의 가이드, 기본값) | 'research'(리서치 자료)
--  tags    : 검색·분류용 짧은 단어 목록
-- 기존 행은 모두 'lecture' 로 남는다. Supabase SQL Editor 에서 1회 실행. 재실행 안전. (운영 적용은 승인 후)
alter table public.reference_doc_uploads
  add column if not exists category text not null default 'lecture',
  add column if not exists tags text[] not null default '{}';

alter table public.reference_doc_submissions
  add column if not exists category text not null default 'lecture',
  add column if not exists tags text[] not null default '{}';

alter table public.reference_doc_uploads drop constraint if exists reference_doc_uploads_category_check;
alter table public.reference_doc_uploads
  add constraint reference_doc_uploads_category_check check (category in ('lecture', 'research'));

alter table public.reference_doc_submissions drop constraint if exists reference_doc_submissions_category_check;
alter table public.reference_doc_submissions
  add constraint reference_doc_submissions_category_check check (category in ('lecture', 'research'));

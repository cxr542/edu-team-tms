# 공지 반응·댓글 — 적용 체크리스트

## 사람 작업 (필수)

1. Supabase SQL Editor에서 [`supabase/announcement-engagement.sql`](../supabase/announcement-engagement.sql) 실행
2. Table Editor에서 `announcement_reactions`, `announcement_comments` 존재 확인
3. Preview/Prod에서 `/yhkim?module=announcements` → 이모지 토글 → 댓글 등록

## 앱 경로

| API | 역할 |
|-----|------|
| `GET/POST /api/announcement-reactions` | 집계·토글 |
| `GET/POST /api/announcement-comments` | 목록·등록·소프트 삭제 |

신원: URL 스코프 `memberCode` (A/B/C). `/admin`은 A만.

## 비범위

Realtime, 커스텀 이모지, Supabase Auth.

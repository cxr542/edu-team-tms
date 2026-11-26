/**
 * 공지 「보관 처리」 규칙. 보관 = 게시 해제(is_published=false)이며 삭제가 아니다.
 * 대상: 게시 중이고, 고정(핀)이 아니고, 릴리즈노트 분류가 아니고, 게시한 지 ARCHIVE_AFTER_DAYS 일이 지난 공지.
 * 릴리즈노트 분류는 공지사항 화면이 날짜별 변경 이력으로 보여 주므로 보관 대상에서 뺀다.
 */
export const ARCHIVE_AFTER_DAYS = 90;
/** 한 번에 처리할 최대 건수 (요청 크기·실수 방지) */
export const ARCHIVE_MAX_IDS = 200;
/** 보관 대상에서 제외하는 분류 */
export const ARCHIVE_EXCLUDED_CATEGORIES = ['release'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function archiveCutoffIso(now = new Date(), days = ARCHIVE_AFTER_DAYS) {
  return new Date(now.getTime() - days * MS_PER_DAY).toISOString();
}

/** DB 행(snake_case)이 보관 대상인지 */
export function isArchiveCandidate(row, now = new Date(), days = ARCHIVE_AFTER_DAYS) {
  if (!row || row.is_published !== true || row.is_pinned === true) return false;
  if (ARCHIVE_EXCLUDED_CATEGORIES.includes(row.category)) return false;
  const publishedAt = Date.parse(row.published_at || '');
  if (!Number.isFinite(publishedAt)) return false;
  return publishedAt <= now.getTime() - days * MS_PER_DAY;
}

/** 되돌리기 대상: 한 번이라도 게시된 적이 있는(published_at 이 있는) 게시 해제 공지. 임시저장 글은 제외한다. */
export function isRestorable(row) {
  return Boolean(row) && row.is_published === false && Boolean(row.published_at);
}

/** ids 요청 본문 검증: 문자열 배열, 중복 제거, 1~ARCHIVE_MAX_IDS 건. 잘못되면 null */
export function sanitizeIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map((v) => String(v ?? '').trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > ARCHIVE_MAX_IDS) return null;
  return ids;
}

const ANNOUNCEMENT_ARCHIVE_API = '/api/announcement-archive';

async function call(method, payload) {
  const fail = (status, message) => ({ ok: false, status, message, data: null });
  try {
    const response = await fetch(ANNOUNCEMENT_ARCHIVE_API, {
      method,
      credentials: 'include',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json().catch(() => null);
    if (!body || typeof body.ok !== 'boolean') return fail('error', '응답 형식이 올바르지 않아요');
    if (response.status === 403) {
      return fail('forbidden', body.message || '관리자 세션이 필요해요. /admin 에서 다시 로그인해 주세요.');
    }
    if (!response.ok || !body.ok) return fail(body.status || 'error', body.message || `공지 정리 API 오류 (${response.status})`);
    return { ok: true, status: 'ok', message: '', data: body.data };
  } catch (error) {
    return fail('error', error instanceof Error ? error.message : '공지 정리 요청에 실패했어요');
  }
}

/** 보관 대상 미리보기 (아무것도 바꾸지 않는다). data = {days, items[], truncated} */
export const previewAnnouncementArchive = () => call('GET');

/** 미리보기에서 본 공지를 게시 해제한다. data = {changedIds[], skipped} */
export const archiveAnnouncements = (ids) => call('POST', { action: 'archive', ids });

/** 방금 보관한 공지를 다시 게시한다. data = {changedIds[], skipped} */
export const restoreAnnouncements = (ids) => call('POST', { action: 'restore', ids });

/** 미리보기 data → 대화상자에 보일 줄 */
export function describeArchivePreview(data) {
  const items = data?.items || [];
  if (items.length === 0) return [`게시 ${data?.days ?? 90}일이 지난 대상 공지가 없습니다.`];
  const shown = items.slice(0, 8).map((i) => `${i.title} (${String(i.publishedAt || '').slice(0, 10)})`);
  const rest = items.length - shown.length;
  return [
    `게시 ${data.days}일 경과 공지 ${items.length}건${data.truncated ? '(한 번에 처리하는 최대 건수)' : ''} → 게시 해제`,
    ...shown,
    ...(rest > 0 ? [`… 외 ${rest}건`] : []),
    '고정 공지는 제외, 삭제 없음(되돌릴 수 있음)',
  ];
}

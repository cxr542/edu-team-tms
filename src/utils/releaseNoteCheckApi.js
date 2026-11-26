const RELEASE_NOTE_CHECK_API = '/api/release-note-check';

/** 릴리즈노트 누락분 점검 결과를 읽는다 (읽기 전용). 성공하면 data = {days, checkedCount, missing[]} */
export async function fetchReleaseNoteCheck() {
  const fail = (status, message) => ({ ok: false, status, message, data: null });
  try {
    const response = await fetch(RELEASE_NOTE_CHECK_API, { credentials: 'include' });
    const body = await response.json().catch(() => null);
    if (!body || typeof body.ok !== 'boolean') return fail('error', '응답 형식이 올바르지 않아요');
    if (response.status === 403) {
      return fail('forbidden', body.message || '관리자 세션이 필요해요. /admin 에서 다시 로그인해 주세요.');
    }
    if (!response.ok || !body.ok) return fail(body.status || 'error', body.message || `점검 API 오류 (${response.status})`);
    return { ok: true, status: 'ok', message: '', data: body.data };
  } catch (error) {
    return fail('error', error instanceof Error ? error.message : '점검 요청에 실패했어요');
  }
}

/** 점검 결과 → 카드에 보일 한 줄 요약과 상세 줄 */
export function summarizeReleaseNoteCheck(data) {
  const missing = data?.missing || [];
  return {
    label: missing.length === 0 ? '누락 0건' : `누락 ${missing.length}건`,
    lines:
      missing.length === 0
        ? [`최근 ${data?.days ?? 30}일 머지 PR ${data?.checkedCount ?? 0}건 모두 릴리즈노트에 있습니다.`]
        : missing.map((m) => `#${m.number} ${m.title}`),
  };
}

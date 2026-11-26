const CSR_STALE_CHECK_API = '/api/csr-stale-check';

/** 오래 처리 안 된 CSR 점검 결과를 읽는다 (읽기 전용). data = {days, items[], truncated} */
export async function fetchCsrStaleCheck() {
  const fail = (status, message) => ({ ok: false, status, message, data: null });
  try {
    const response = await fetch(CSR_STALE_CHECK_API, { credentials: 'include' });
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
export function summarizeCsrStaleCheck(data) {
  const items = data?.items || [];
  if (items.length === 0) {
    return { label: '대상 0건', lines: [`접수·진행 중인 요청 중 ${data?.days ?? 30}일 넘게 멈춘 것이 없습니다.`] };
  }
  const shown = items.slice(0, 8).map((i) => `[${i.statusLabel}] ${i.title} (${String(i.updatedAt || '').slice(0, 10)})`);
  const rest = items.length - shown.length;
  return {
    label: `${items.length}건`,
    lines: [...shown, ...(rest > 0 ? [`… 외 ${rest}건`] : [])],
  };
}

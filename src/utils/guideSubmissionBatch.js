/**
 * 승인 대기 문서를 차례로 승인한다. 한 건이 실패해도 나머지는 계속 처리하고,
 * 실패한 항목과 이유를 모아 돌려준다. (서버 검증·정화를 그대로 쓰도록 한 건씩 기존 승인 API 를 부른다)
 *
 * @param {{ id: string, title: string }[]} items
 * @param {(id: string) => Promise<{ ok: boolean, data?: { id: string }, message?: string }>} approveOne
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<{ approvedIds: string[], failed: { id: string, title: string, message: string }[] }>}
 */
export async function approveSubmissionsInOrder(items, approveOne, onProgress) {
  const approvedIds = [];
  const failed = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    let res;
    try {
      res = await approveOne(it.id);
    } catch (error) {
      res = { ok: false, message: error?.message || '네트워크 오류' };
    }
    if (res?.ok) approvedIds.push(res.data?.id || it.id);
    else failed.push({ id: it.id, title: it.title, message: res?.message || '승인하지 못했습니다.' });
    onProgress?.(i + 1, items.length);
  }
  return { approvedIds, failed };
}

/** 저장 시각(UTC ISO) → 보는 사람 기준 현지 시각 "YYYY-MM-DD HH:mm". */
export function formatLocalDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

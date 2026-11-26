/**
 * 오래 처리 안 된 CSR 요청 점검 (읽기 전용, service role). 관리자 세션이 있어야 한다.
 *  - GET : 접수·진행 중인 채로 CSR_STALE_DAYS 일 넘게 갱신되지 않은 요청 목록. 아무것도 바꾸지 않는다.
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import {
  CSR_STALE_DAYS,
  CSR_STALE_MAX_ITEMS,
  CSR_STALE_STATUSES,
  csrStaleCutoffIso,
  isStaleCsr,
} from '../../src/utils/csrStale.js';
import { formatCsrRequestStatusLabel } from '../../src/constants/csrRequests.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function handleCsrStaleCheck(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 점검할 수 있습니다.' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, status: 'error', message: 'method not allowed' });
  }

  const now = new Date();
  const { data, error } = await client
    .from('csr_requests')
    .select('id, title, status, requester, created_at, updated_at')
    .in('status', CSR_STALE_STATUSES)
    .lt('updated_at', csrStaleCutoffIso(now))
    .order('updated_at', { ascending: true })
    .limit(CSR_STALE_MAX_ITEMS);
  if (error) {
    console.error('[csr-stale-check] read failed:', error?.message || error);
    return json(res, 500, { ok: false, status: 'error', message: 'CSR 요청을 읽지 못했습니다.' });
  }

  const items = (data || [])
    .filter((row) => isStaleCsr(row, now))
    .map((row) => ({
      id: row.id,
      title: String(row.title || '').trim(),
      statusLabel: formatCsrRequestStatusLabel(row.status),
      requester: String(row.requester || '').trim(),
      updatedAt: row.updated_at || null,
    }));
  return json(res, 200, {
    ok: true,
    status: 'ok',
    data: { days: CSR_STALE_DAYS, items, truncated: items.length >= CSR_STALE_MAX_ITEMS },
  });
}

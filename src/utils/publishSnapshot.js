import { PUBLIC_SNAPSHOT_PATH } from './appMode';
import { normalizeViewerMenuVisibility } from '../constants/viewerMenu';

export function buildTeamSnapshot(transactions, categories, viewerMenuVisibility = null) {
  return {
    publishedAt: new Date().toISOString(),
    categories,
    transactions,
    viewerMenuVisibility:
      viewerMenuVisibility && typeof viewerMenuVisibility === 'object'
        ? normalizeViewerMenuVisibility(viewerMenuVisibility)
        : undefined,
  };
}

export function downloadTeamSnapshot(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ledger-snapshot.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function parseSnapshotResponse(res) {
  if (!res.ok) {
    throw new Error(`공개 장부를 불러오지 못했습니다 (${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data.transactions)) {
    throw new Error('공개 장부 형식이 올바르지 않습니다.');
  }
  return data;
}

/** 조회용 장부 — API(Blob) 우선, 없으면 정적 ledger-snapshot.json */
export async function fetchPublicSnapshot() {
  const cacheBust = `t=${Date.now()}`;
  try {
    const apiRes = await fetch(`/api/ledger-snapshot?${cacheBust}`);
    if (apiRes.ok) return parseSnapshotResponse(apiRes);
  } catch {
    /* API 미구성 시 정적 파일 */
  }
  const res = await fetch(`${PUBLIC_SNAPSHOT_PATH}?${cacheBust}`);
  return parseSnapshotResponse(res);
}

/** 작성(관리자) 장부 → 조회용 서버(Blob) 즉시 반영 */
export async function publishSnapshotToServer(payload) {
  const headers = { 'Content-Type': 'application/json' };
  const publishKey = import.meta.env.VITE_LEDGER_PUBLISH_KEY;
  if (publishKey) headers['x-ledger-publish-key'] = publishKey;

  const res = await fetch('/api/ledger-snapshot', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  const failMsg = body.message || body.error || String(res.status);
  if (res.status === 501) {
    return { ok: false, reason: 'not-configured', message: body.message };
  }
  if (res.status === 507 || /quota|exceeded/i.test(failMsg)) {
    return { ok: false, reason: 'quota-exceeded', message: body.message || failMsg };
  }
  if (res.status === 403) {
    return { ok: false, reason: 'not-allowed', message: body.message };
  }
  if (!res.ok) {
    return { ok: false, reason: body.error || String(res.status), message: body.message || failMsg };
  }
  return { ok: true, publishedAt: body.publishedAt || payload.publishedAt };
}

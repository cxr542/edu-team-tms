import { PUBLIC_SNAPSHOT_PATH } from './appMode';
import { normalizeViewerMenuVisibility } from '../constants/viewerMenu';
import { canAttemptCloudWrite, recordCloudFailure, recordCloudSuccess } from './cloudHealth';

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

function snapshotFetchError(res, body = {}) {
  const err = new Error(
    body.message || body.error || `공개 장부를 불러오지 못했습니다 (${res.status})`
  );
  err.status = res.status;
  err.body = body;
  return err;
}

async function parseSnapshotResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    recordCloudFailure(res.status, data);
    throw snapshotFetchError(res, data);
  }
  if (!Array.isArray(data.transactions)) {
    throw new Error('공개 장부 형식이 올바르지 않습니다.');
  }
  recordCloudSuccess();
  return data;
}

/** 조회용 장부 — API(Blob) 우선, 없으면 정적 ledger-snapshot.json */
export async function fetchPublicSnapshot() {
  const cacheBust = `t=${Date.now()}`;
  let apiFailed = null;
  try {
    const apiRes = await fetch(`/api/ledger-snapshot?${cacheBust}`);
    if (apiRes.ok) return parseSnapshotResponse(apiRes);
    const body = await apiRes.json().catch(() => ({}));
    apiFailed = snapshotFetchError(apiRes, body);
    recordCloudFailure(apiRes.status, body);
  } catch (e) {
    if (e?.status) throw e;
    /* API 미구성·네트워크 — 정적 파일 시도 */
  }
  const res = await fetch(`${PUBLIC_SNAPSHOT_PATH}?${cacheBust}`);
  if (!res.ok) {
    if (apiFailed) throw apiFailed;
    return parseSnapshotResponse(res);
  }
  return parseSnapshotResponse(res);
}

/** 작성(관리자) 장부 → 조회용 서버(Blob) 즉시 반영 */
export async function publishSnapshotToServer(payload) {
  if (!canAttemptCloudWrite()) {
    return {
      ok: false,
      reason: 'cloud-limited',
      message: '클라우드 공유가 일시 제한되었습니다. 잠시 후 다시 시도하세요.',
    };
  }

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
    recordCloudFailure(res.status, body);
    return { ok: false, reason: 'quota-exceeded', message: body.message || failMsg };
  }
  if (res.status === 403) {
    return { ok: false, reason: 'not-allowed', message: body.message };
  }
  if (!res.ok) {
    recordCloudFailure(res.status, body);
    return { ok: false, reason: body.error || String(res.status), message: body.message || failMsg };
  }
  recordCloudSuccess();
  return { ok: true, publishedAt: body.publishedAt || payload.publishedAt };
}

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

export function isLedgerSnapshotImportable(raw) {
  return Boolean(raw && typeof raw === 'object' && Array.isArray(raw.transactions));
}

export function parseLedgerSnapshotForImport(raw) {
  if (!isLedgerSnapshotImportable(raw)) {
    throw new Error('장부 백업 형식이 올바르지 않습니다. (transactions 배열 필요)');
  }
  return {
    publishedAt: raw.publishedAt || new Date().toISOString(),
    categories: raw.categories,
    transactions: raw.transactions,
    viewerMenuVisibility: raw.viewerMenuVisibility,
  };
}

export async function readLedgerSnapshotFile(file) {
  const text = await file.text();
  return parseLedgerSnapshotForImport(JSON.parse(text));
}

export const EMPTY_LEDGER_SNAPSHOT_TITLE = '아직 게시된 장부 조회 snapshot이 없습니다.';
export const EMPTY_LEDGER_SNAPSHOT_DETAIL =
  '장부 데이터를 조회 화면에 반영하려면 팀장/편집 화면에서 수동으로 게시하거나 새로고침해 주세요. 브라우저 로컬 저장 데이터는 계속 사용할 수 있습니다.';

export function isLedgerSnapshotNotFound(status, body = {}) {
  const err = String(body?.error || body?.message || '');
  return status === 404 && err.includes('snapshot not found');
}

export function isLedgerSnapshotAccessDenied(status) {
  return status === 401 || status === 403;
}

function snapshotFetchError(res, body = {}, { warning = false } = {}) {
  const err = new Error(
    body.message || body.error || `공개 장부를 불러오지 못했습니다 (${res.status})`
  );
  err.status = res.status;
  err.body = body;
  err.isWarning = warning;
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

async function fetchStaticPublicSnapshot(cacheBust) {
  try {
    const res = await fetch(`${PUBLIC_SNAPSHOT_PATH}?${cacheBust}`);
    if (res.ok) return { kind: 'data', value: await parseSnapshotResponse(res) };
    const body = await res.json().catch(() => ({}));
    if (res.status === 404 || isLedgerSnapshotNotFound(res.status, body)) {
      return { kind: 'empty' };
    }
    return { kind: 'error', error: snapshotFetchError(res, body) };
  } catch {
    return { kind: 'unavailable' };
  }
}

/** 조회용 장부 — API(Blob) 우선, 없으면 정적 ledger-snapshot.json */
export async function fetchPublicSnapshot() {
  const cacheBust = `t=${Date.now()}`;
  try {
    const apiRes = await fetch(`/api/ledger-snapshot?${cacheBust}`);
    if (apiRes.ok) return parseSnapshotResponse(apiRes);
    const body = await apiRes.json().catch(() => ({}));

    if (isLedgerSnapshotNotFound(apiRes.status, body)) {
      const staticResult = await fetchStaticPublicSnapshot(cacheBust);
      if (staticResult.kind === 'data') return staticResult.value;
      return null;
    }

    if (isLedgerSnapshotAccessDenied(apiRes.status)) {
      const staticResult = await fetchStaticPublicSnapshot(cacheBust);
      if (staticResult.kind === 'data') return staticResult.value;
      throw snapshotFetchError(apiRes, body, { warning: true });
    }

    recordCloudFailure(apiRes.status, body);
    const staticResult = await fetchStaticPublicSnapshot(cacheBust);
    if (staticResult.kind === 'data') return staticResult.value;
    if (staticResult.kind === 'error') throw staticResult.error;
    throw snapshotFetchError(apiRes, body);
  } catch (e) {
    if (e?.status) throw e;
    const staticResult = await fetchStaticPublicSnapshot(cacheBust);
    if (staticResult.kind === 'data') return staticResult.value;
    if (staticResult.kind === 'empty') return null;
    if (staticResult.kind === 'error') throw staticResult.error;
    throw new Error('공개 장부를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.');
  }
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

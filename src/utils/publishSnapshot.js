import { normalizeViewerMenuVisibility } from '../constants/viewerMenu';
import { fetchLedgerSnapshotFromSupabase } from './ledgerSupabaseRead';
import { getSupabaseClient } from './supabaseClient';

export function buildTeamSnapshot(transactions, categories, viewerMenuVisibility = null) {
  return {
    publishedAt: new Date().toISOString(),
    categories,
    // 편집 화면의 낙관적 잠금용 `_version` 은 백업·게시 파일에 넣지 않는다.
    transactions: transactions.map(({ _version, ...tx }) => tx),
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

export const EMPTY_LEDGER_SNAPSHOT_TITLE = '아직 등록된 장부 데이터가 없습니다.';
export const EMPTY_LEDGER_SNAPSHOT_DETAIL =
  '관리자 화면에서 지출을 입력하면 이곳에 바로 표시됩니다.';

/**
 * 조회용 장부 — Supabase(ledger_*)에서 읽는다.
 * Supabase 가 설정되지 않았으면 오류, 거래가 하나도 없으면 null(빈 상태 안내).
 */
export async function fetchPublicSnapshot() {
  if (!getSupabaseClient()) {
    throw new Error('Supabase 가 설정되지 않아 장부를 불러올 수 없습니다. 관리자에게 문의하세요.');
  }
  return fetchLedgerSnapshotFromSupabase();
}

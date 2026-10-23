/**
 * 이관 전(localStorage 작성본 시대) 브라우저에 남은 장부 작성본.
 * 장부는 이제 Supabase 가 기준이라 여기에 쓰지 않고, 남은 작성본을 점검·정리할 때만 읽는다
 * (useLegacyLedgerDraft: 서버와 같으면 조용히 지우고, 다르면 백업 후 폐기를 고르게 한다).
 */
export const TRANSACTIONS_STORAGE_KEY = 'tms-transactions-v1';
export const LEDGER_META_KEY = 'tms-ledger-meta-v1';

export function loadStoredTransactions() {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredTransactions() {
  localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
  localStorage.removeItem(LEDGER_META_KEY);
}

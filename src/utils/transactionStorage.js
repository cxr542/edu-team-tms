export const TRANSACTIONS_STORAGE_KEY = 'tms-transactions-v1';
export const LEDGER_META_KEY = 'tms-ledger-meta-v1';

export function loadLedgerMeta() {
  try {
    const raw = localStorage.getItem(LEDGER_META_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveLedgerMeta(meta) {
  try {
    localStorage.setItem(LEDGER_META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.warn('TMS: 장부 메타 저장 실패', err);
  }
}

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

export function saveStoredTransactions(transactions) {
  try {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    console.warn('TMS: 지출 장부 저장 실패', err);
  }
}

export function clearStoredTransactions() {
  localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
  localStorage.removeItem(LEDGER_META_KEY);
}

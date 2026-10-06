/**
 * 서버 쓰기 API(/api/ledger-snapshot?resource=…) 클라이언트.
 * 실패는 LedgerClientError(status, code, message, currentVersion)로 던진다.
 */
const ENDPOINT = '/api/ledger-snapshot';

export class LedgerClientError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'LedgerClientError';
    this.status = status;
    this.code = code;
    this.currentVersion = extra.currentVersion ?? null;
  }
}

/** 사용자에게 보여줄 한국어 메시지 */
export function describeLedgerClientError(err) {
  if (!(err instanceof LedgerClientError)) return `저장에 실패했습니다. (${err?.message || '알 수 없는 오류'})`;
  if (err.code === 'version-conflict') return '다른 곳에서 먼저 수정된 항목이 있어 저장하지 않았습니다. 최신 내용으로 다시 불러왔습니다.';
  if (err.code === 'not-found') return '이미 삭제된 항목입니다. 최신 내용으로 다시 불러왔습니다.';
  if (err.code === 'duplicate-id') return '같은 id의 항목이 이미 있어 저장하지 않았습니다.';
  if (err.status === 403) return '관리자 로그인이 필요합니다. /admin 에서 다시 로그인한 뒤 시도해 주세요.';
  if (err.status === 501) return '서버에 Supabase 설정이 없어 저장하지 못했습니다. 관리자에게 문의하세요.';
  if (err.status === 400) return `입력값을 확인해 주세요: ${err.message}`;
  return `저장에 실패했습니다. (${err.message})`;
}

export function createLedgerApi(fetchImpl = (...a) => fetch(...a)) {
  async function call(method, resource, { query = {}, body } = {}) {
    const params = new URLSearchParams({ resource, ...query });
    let res;
    try {
      res = await fetchImpl(`${ENDPOINT}?${params}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
    } catch (e) {
      throw new LedgerClientError(0, 'network', e?.message || '네트워크 오류');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new LedgerClientError(res.status, data.error || 'error', data.message || data.error || `HTTP ${res.status}`, data);
    }
    return data;
  }

  return {
    createTransaction: (transaction) => call('POST', 'transactions', { body: { transaction } }),
    updateTransaction: (id, transaction, expectedVersion) =>
      call('PATCH', 'transactions', { query: { id }, body: { transaction, expectedVersion } }),
    deleteTransaction: (id, expectedVersion) =>
      call('DELETE', 'transactions', { query: { id, expectedVersion: String(expectedVersion) } }),
    bulkTransactions: (transactions, { mode = 'merge', confirmReplace = false } = {}) =>
      call('POST', 'transactions-bulk', { body: { transactions, mode, confirmReplace } }),
    putCategories: (categories) => call('PUT', 'categories', { body: { categories } }),
    putSetting: (key, value, expectedVersion) =>
      call('PUT', 'settings', { body: { key, value, expectedVersion } }),
  };
}

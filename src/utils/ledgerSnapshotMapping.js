/**
 * ledger_* DB 행 ↔ 공개 스냅샷 모양 변환 (순수 함수 — 브라우저·Node 스크립트 공용).
 */

function dropNullish(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

/** @param {{ withVersion?: boolean }} [options] withVersion: 편집 화면용 낙관적 잠금 버전을 `_version` 으로 싣는다. */
export function transactionFromRow(row, { withVersion = false } = {}) {
  const extra = row.extra_data && typeof row.extra_data === 'object' ? row.extra_data : {};
  return dropNullish({
    id: row.id,
    date: row.tx_date,
    category: row.category,
    description: row.description,
    amount: row.amount,
    balance: row.balance,
    paymentMethod: row.payment_method,
    attendees: row.attendees,
    extraData: Object.keys(extra).length ? extra : undefined,
    _version: withVersion ? row.version : undefined,
  });
}

export function categoryFromRow(row) {
  return dropNullish({
    id: row.id,
    label: row.label,
    color: row.color,
    description: row.description,
    matchKeywords: Array.isArray(row.match_keywords) ? row.match_keywords : [],
  });
}

function latestStamp(rows) {
  const stamps = rows.map((r) => Date.parse(r.updated_at)).filter(Number.isFinite);
  return new Date(stamps.length ? Math.max(...stamps) : Date.now()).toISOString();
}

/**
 * ledger_* 행 → 공개 스냅샷 모양. 거래가 하나도 없으면 null (호출자가 Blob 경로로 되돌리기 위함).
 * publishedAt 은 세 테이블 중 가장 늦은 updated_at.
 */
export function buildSnapshotFromRows({ transactions = [], categories = [], settings = [] }) {
  if (!transactions.length) return null;
  const menu = settings.find((s) => s.key === 'viewer_menu_visibility')?.value;
  return {
    publishedAt: latestStamp([...transactions, ...categories, ...settings]),
    categories: categories.map(categoryFromRow),
    transactions: transactions.map((r) => transactionFromRow(r)),
    viewerMenuVisibility: menu && typeof menu === 'object' ? menu : undefined,
  };
}

/** 편집 화면용: 버전 정보를 포함해 읽는다. 거래가 비어 있어도 null 이 아니다. */
export function buildEditDataFromRows({ transactions = [], categories = [], settings = [] }) {
  const menuRow = settings.find((s) => s.key === 'viewer_menu_visibility');
  return {
    publishedAt: latestStamp([...transactions, ...categories, ...settings]),
    transactions: transactions.map((r) => transactionFromRow(r, { withVersion: true })),
    categories: categories.map(categoryFromRow),
    menuVisibility: menuRow?.value && typeof menuRow.value === 'object' ? menuRow.value : null,
    menuVersion: menuRow?.version ?? null,
  };
}
